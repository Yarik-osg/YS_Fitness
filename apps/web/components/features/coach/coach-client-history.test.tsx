import { useQueryClient } from '@tanstack/react-query';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { CoachClientHistory } from './coach-client-history';

const api = vi.hoisted(() => ({
  workouts: vi.fn(),
  measurements: vi.fn(),
  strength: vi.fn(),
  photos: vi.fn(),
  photoBlob: vi.fn(),
}));

vi.mock('@/lib/api/coach', () => ({
  listCoachWorkouts: api.workouts,
  listCoachMeasurements: api.measurements,
  listCoachStrength: api.strength,
  listCoachProgressPhotos: api.photos,
  getCoachProgressPhotoBlob: api.photoBlob,
}));

const session = {
  id: 'log-1',
  completedAt: '2026-04-12T09:30:00.000Z',
  dayNumber: 2,
  templateCode: 'OLD',
  templateName: 'Previous block',
  sets: [
    {
      order: 1,
      setNumber: 1,
      repsCompleted: 8,
      weightKg: 20,
      exercise: { name: 'Тяга', nameEn: 'Row' },
    },
  ],
};

function emptyHistory() {
  api.workouts.mockResolvedValue({ logs: [], total: 0 });
  api.measurements.mockResolvedValue({
    measurements: [],
    firstMeasurement: null,
  });
  api.strength.mockResolvedValue({ changes: [] });
  api.photos.mockResolvedValue({ photos: [] });
}

function renderHistory(userId = 'client-1', locale: 'en' | 'uk' = 'en') {
  return render(
    <Providers>
      <I18nTestProvider locale={locale}>
        <CoachClientHistory userId={userId} />
      </I18nTestProvider>
    </Providers>,
  );
}

describe('CoachClientHistory', () => {
  beforeEach(() => {
    cleanup();
    api.workouts.mockReset();
    api.measurements.mockReset();
    api.strength.mockReset();
    api.photos.mockReset();
    api.photoBlob.mockReset();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:coach-photo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('shows a loading skeleton until the session page arrives', () => {
    emptyHistory();
    api.workouts.mockReturnValue(new Promise(() => undefined));

    renderHistory();

    expect(
      screen.getByRole('heading', { name: 'Sessions' }),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the recorded session in English and Ukrainian', async () => {
    emptyHistory();
    api.workouts.mockResolvedValue({ logs: [session], total: 1 });

    const view = renderHistory();
    expect(await screen.findByText('Row')).toBeInTheDocument();
    expect(screen.getByText(/Day 2/)).toBeInTheDocument();
    expect(screen.getByText(/8 reps/)).toBeInTheDocument();
    expect(screen.getByText(/20\.0 kg/)).toBeInTheDocument();
    expect(screen.getByText('No weight entries yet.')).toBeInTheDocument();

    view.rerender(
      <Providers>
        <I18nTestProvider locale="uk">
          <CoachClientHistory userId="client-1" />
        </I18nTestProvider>
      </Providers>,
    );
    expect(await screen.findByText('Тяга')).toBeInTheDocument();
  });

  it('keeps a loaded session when weight fails and retries that section', async () => {
    emptyHistory();
    api.workouts.mockResolvedValue({ logs: [session], total: 1 });
    api.measurements.mockRejectedValue(
      new ApiClientError(500, 'SERVER_ERROR', 'down'),
    );

    renderHistory();

    expect(await screen.findByText('Row')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This section could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(api.measurements).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Row')).toBeInTheDocument();
  });

  it('keeps the first page when the next page fails and skips a repeated session', async () => {
    emptyHistory();
    const second = {
      ...session,
      id: 'log-2',
      dayNumber: 3,
    };
    api.workouts.mockImplementation(
      (_userId: string, _limit: number, offset: number) => {
        if (offset === 0) {
          return Promise.resolve({ logs: [session], total: 2 });
        }
        return Promise.reject(new ApiClientError(500, 'SERVER_ERROR', 'down'));
      },
    );

    renderHistory();
    expect(await screen.findByText(/Day 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This section could not be loaded.',
    );
    expect(screen.getByText(/Day 2/)).toBeInTheDocument();

    api.workouts.mockImplementation(
      (_userId: string, _limit: number, offset: number) => {
        if (offset === 0) {
          return Promise.resolve({ logs: [session], total: 2 });
        }
        return Promise.resolve({ logs: [session, second], total: 2 });
      },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Day 3/)).toBeInTheDocument();
    expect(screen.getAllByText(/Day 2/)).toHaveLength(1);
  });

  it('keeps long exercise and strength lists collapsed', async () => {
    emptyHistory();
    const sets = Array.from({ length: 5 }, (_, index) => ({
      order: index + 1,
      setNumber: 1,
      repsCompleted: 8,
      weightKg: 20,
      exercise: { name: `Вправа ${index + 1}`, nameEn: `Move ${index + 1}` },
    }));
    api.workouts.mockResolvedValue({
      logs: [
        { ...session, sets },
        {
          ...session,
          id: 'log-2',
          dayNumber: 9,
          sets: [
            {
              order: 1,
              setNumber: 1,
              repsCompleted: 8,
              weightKg: 20,
              exercise: { name: 'Схована', nameEn: 'Hidden row' },
            },
          ],
        },
      ],
      total: 2,
    });
    api.strength.mockResolvedValue({
      changes: ['A', 'B', 'C', 'D'].map((name, index) => ({
        exerciseId: `ex-${index}`,
        name,
        nameEn: name,
        fromKg: 10,
        toKg: 20,
      })),
    });

    renderHistory();

    expect(await screen.findByText('Move 4')).toBeInTheDocument();
    expect(screen.queryByText('Move 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden row')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.queryByText('D')).not.toBeInTheDocument();

    const sessions = screen
      .getByRole('heading', { name: 'Sessions' })
      .closest('section');
    const strength = screen
      .getByRole('heading', { name: 'Strength' })
      .closest('section');
    if (!sessions || !strength) throw new Error('missing section');

    await userEvent.click(
      within(sessions).getByRole('button', { name: 'Show all' }),
    );
    expect(screen.getByText('Move 5')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Day 9/ }));
    expect(screen.getByText('Hidden row')).toBeInTheDocument();

    await userEvent.click(
      within(strength).getByRole('button', { name: 'Show all' }),
    );
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('drops the previous client while the next client is still loading', async () => {
    emptyHistory();
    api.workouts.mockResolvedValue({ logs: [session], total: 1 });
    api.photos.mockResolvedValue({
      photos: [
        {
          id: 'photo-1',
          createdAt: '2026-04-12T09:30:00.000Z',
          contentType: 'image/jpeg',
          width: 2,
          height: 2,
        },
      ],
    });
    api.photoBlob.mockResolvedValue(new Blob(['jpeg']));

    const view = renderHistory('client-1');
    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      'blob:coach-photo',
    );

    api.workouts.mockReturnValue(new Promise(() => undefined));
    api.photos.mockReturnValue(new Promise(() => undefined));
    view.rerender(
      <Providers>
        <I18nTestProvider locale="en">
          <CoachClientHistory userId="client-2" />
        </I18nTestProvider>
      </Providers>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Row')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:coach-photo');
    expect(api.workouts).toHaveBeenCalledWith('client-2', 20, 0);
  });

  it('keeps a shown photo until the refreshed blob is ready', async () => {
    emptyHistory();
    const photo = {
      id: 'photo-1',
      createdAt: '2026-04-12T09:30:00.000Z',
      contentType: 'image/jpeg' as const,
      width: 2,
      height: 2,
    };
    api.photos.mockResolvedValue({ photos: [photo] });
    api.photoBlob.mockResolvedValue(new Blob(['jpeg']));
    let refreshPhotos = () => Promise.resolve();

    function RefreshableHistory() {
      const client = useQueryClient();
      refreshPhotos = () =>
        client.invalidateQueries({
          queryKey: ['coach', 'clients', 'client-1', 'progress-photos'],
        });
      return <CoachClientHistory userId="client-1" />;
    }

    render(
      <Providers>
        <I18nTestProvider locale="en">
          <RefreshableHistory />
        </I18nTestProvider>
      </Providers>,
    );
    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      'blob:coach-photo',
    );

    let release: (blob: Blob) => void = () => undefined;
    api.photos.mockResolvedValue({ photos: [{ ...photo, width: 3 }] });
    api.photoBlob.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:next-photo');

    await refreshPhotos();

    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:coach-photo');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:coach-photo');

    release(new Blob(['next']));
    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:next-photo');
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:coach-photo');
  });
});
