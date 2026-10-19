import type { WeightMeasurement } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { periodStart } from '@/lib/weight-period';
import { ProgressPage } from './progress-page';

const readProgressPhoto = vi.hoisted(() => vi.fn());

vi.mock('@/lib/progress-photo', () => ({
  readProgressPhoto,
}));

const usersApi = vi.hoisted(() => ({
  getMe: vi.fn(),
  getMeasurements: vi.fn(),
  getProgressPhotos: vi.fn(),
  createMeasurement: vi.fn(),
  createProgressPhoto: vi.fn(),
  getOnboardingResponses: vi.fn(),
  saveOnboarding: vi.fn(),
  updateProfile: vi.fn(),
}));
const programsApi = vi.hoisted(() => ({
  getAssignedProgram: vi.fn(),
  getMyProgram: vi.fn(),
  assignProgram: vi.fn(),
}));
const workoutsApi = vi.hoisted(() => ({
  getStrengthChanges: vi.fn(),
  listWorkoutLogs: vi.fn(),
}));

vi.mock('@/lib/api/users', () => usersApi);
vi.mock('@/lib/api/programs', () => programsApi);
vi.mock('@/lib/api/workouts', () => workoutsApi);
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/progress',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const now = new Date(2025, 4, 31, 15, 30, 0);

function point(
  id: string,
  weightKg: number,
  measuredAt: string,
): WeightMeasurement {
  return { id, weightKg, measuredAt };
}

function chartCircles() {
  const chart = document.querySelector('[role="img"]');
  return chart ? chart.querySelectorAll('circle') : [];
}

function renderPage() {
  return render(
    <Providers>
      <I18nTestProvider>
        <ProgressPage />
      </I18nTestProvider>
    </Providers>,
  );
}

describe('ProgressPage', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    usersApi.getMeasurements.mockReset();
    usersApi.getProgressPhotos.mockReset().mockResolvedValue({ photos: [] });
    readProgressPhoto.mockReset().mockResolvedValue('aGVsbG8=');
    usersApi.createMeasurement.mockReset();
    usersApi.createProgressPhoto.mockReset();
    workoutsApi.getStrengthChanges.mockReset().mockResolvedValue({
      changes: [],
    });
    programsApi.getAssignedProgram.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps start and current outside the selected period and does not refetch', async () => {
    const start = periodStart(now, '3m')!;
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const outside = point(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      60,
      new Date(start.getTime() - 1).toISOString(),
    );
    const boundary = point(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      70,
      start.toISOString(),
    );
    const latest = point(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      80,
      new Date(now.getTime() - 60_000).toISOString(),
    );
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [outside, boundary, latest],
      firstMeasurement: outside,
    });

    renderPage();

    expect(
      await screen.findByText('80,0', { selector: 'span' }),
    ).toBeInTheDocument();
    expect(screen.getByText('+20,0 кг від старту')).toBeInTheDocument();
    expect(screen.getByText(/60,0/, { selector: 'p' })).toBeInTheDocument();
    expect(chartCircles()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Все' }));
    expect(chartCircles()).toHaveLength(3);
    expect(screen.getByText(/60,0/, { selector: 'p' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '3 міс.' }));
    expect(chartCircles()).toHaveLength(2);
    expect(screen.getByText('+20,0 кг від старту')).toBeInTheDocument();
    expect(usersApi.getMeasurements).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Прогрес' })).toHaveAttribute(
      'href',
      '/progress',
    );
    expect(screen.getByRole('link', { name: 'Прогрес' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(screen.getByRole('button', { name: 'Додати вагу' }));
    expect(screen.getByLabelText('Вага (кг)')).toHaveValue(80);
  });

  it('uses an em dash for the delta of a single measurement', async () => {
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [
        point('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 70, now.toISOString()),
      ],
      firstMeasurement: point(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        70,
        now.toISOString(),
      ),
    });

    renderPage();

    expect(await screen.findAllByText('70,0')).not.toHaveLength(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(chartCircles()).toHaveLength(1);
    expect(
      screen.getByRole('img', { name: 'Графік ваги' }),
    ).toBeInTheDocument();
  });

  it('shows an empty state when there are no measurements', async () => {
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [],
      firstMeasurement: null,
    });

    renderPage();

    expect(await screen.findByText('Ще немає вимірювань.')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(5);
  });

  it('appends a weight, keeps the input after a failure, and cancels without saving', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [],
      firstMeasurement: null,
    });

    renderPage();
    await screen.findByRole('button', { name: 'Додати вагу' });

    await user.click(screen.getByRole('button', { name: 'Додати вагу' }));
    await user.type(screen.getByLabelText('Вага (кг)'), '10');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));
    expect(screen.getByRole('alert')).toHaveTextContent('25');
    expect(usersApi.createMeasurement).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Вага (кг)'));
    await user.type(screen.getByLabelText('Вага (кг)'), '70.5');
    usersApi.createMeasurement.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Вага (кг)')).toHaveValue(70.5);

    await user.click(screen.getByRole('button', { name: 'Скасувати' }));
    expect(usersApi.createMeasurement).toHaveBeenCalledTimes(1);
    expect(usersApi.createMeasurement).toHaveBeenCalledWith({ weightKg: 70.5 });

    usersApi.createMeasurement.mockResolvedValueOnce(
      point('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 70.5, now.toISOString()),
    );
    await user.click(screen.getByRole('button', { name: 'Додати вагу' }));
    const input = screen.getByLabelText('Вага (кг)');
    await user.clear(input);
    await user.type(input, '70.5');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));
    expect(
      await screen.findByRole('button', { name: 'Додати вагу' }),
    ).toBeInTheDocument();
    expect(usersApi.createMeasurement).toHaveBeenCalledTimes(2);
  });

  it('shows program completion above the expected count and omits the card when there is no program', async () => {
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [],
      firstMeasurement: null,
    });
    programsApi.getAssignedProgram.mockResolvedValue({
      programProgress: { completed: 26, expected: 24 },
    });

    const view = renderPage();
    expect(
      await screen.findByText('Виконано 26 з 24 за програмою'),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
    expect(screen.getByText('100%')).toBeInTheDocument();

    view.unmount();
    programsApi.getAssignedProgram.mockResolvedValue(null);
    renderPage();
    await screen.findByText('Ще немає вимірювань.');
    expect(
      screen.queryByRole('heading', { name: 'Тренування' }),
    ).not.toBeInTheDocument();
  });

  it('shows a program error without hiding weight', async () => {
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [
        point('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 70, now.toISOString()),
      ],
      firstMeasurement: point(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        70,
        now.toISOString(),
      ),
    });
    programsApi.getAssignedProgram.mockRejectedValue(new Error('down'));

    renderPage();

    expect(await screen.findAllByText('70,0')).not.toHaveLength(0);
    expect(
      await screen.findByText('Не вдалося завантажити програму.'),
    ).toBeInTheDocument();
  });

  it('ranks a gain above a loss and shows one photo as now', async () => {
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [],
      firstMeasurement: null,
    });
    workoutsApi.getStrengthChanges.mockResolvedValue({
      changes: [
        {
          exerciseId: 'curl',
          name: 'Згинання',
          nameEn: 'Curl',
          fromKg: 3,
          toKg: 12,
        },
        {
          exerciseId: 'bridge',
          name: 'Міст',
          nameEn: 'Bridge',
          fromKg: 100,
          toKg: 12,
        },
      ],
    });
    usersApi.getProgressPhotos.mockResolvedValue({
      photos: [
        {
          id: 'photo-1',
          createdAt: '2026-08-02T00:00:00.000Z',
          contentType: 'image/jpeg',
          imageBase64: 'aGVsbG8=',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('Згинання')).toBeInTheDocument();
    const names = screen.getAllByText(/Згинання|Міст/);
    expect(names[0]).toHaveTextContent('Згинання');
    expect(screen.getByText('+9,0').className).toContain('text-teal');
    expect(screen.getByText('−88,0').className).toContain('text-amber');
    expect(screen.getByRole('img', { name: 'Зараз' })).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Старт' }),
    ).not.toBeInTheDocument();
  });

  it('shows the photo limit when the upload is refused', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usersApi.getMeasurements.mockResolvedValue({
      measurements: [],
      firstMeasurement: null,
    });
    usersApi.createProgressPhoto.mockRejectedValue(
      new ApiClientError(400, 'PHOTO_LIMIT', 'limit'),
    );

    renderPage();
    await screen.findByText('Ще немає вимірювань.');
    await user.upload(
      screen.getByLabelText('Додати фото'),
      new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
    );

    expect(
      await screen.findByText('Можна зберегти не більше 8 фото.'),
    ).toBeInTheDocument();
  });
});
