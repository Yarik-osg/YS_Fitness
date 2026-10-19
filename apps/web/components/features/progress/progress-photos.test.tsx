import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { ProgressPhotos } from './progress-photos';

const usersApi = vi.hoisted(() => ({
  getProgressPhotoBlob: vi.fn(),
  deleteProgressPhoto: vi.fn(),
  createProgressPhoto: vi.fn(),
  getProgressPhotos: vi.fn(),
  getMe: vi.fn(),
  getMeasurements: vi.fn(),
  createMeasurement: vi.fn(),
  getOnboardingResponses: vi.fn(),
  saveOnboarding: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('@/lib/api/users', () => usersApi);
vi.mock('@/lib/progress-photo', () => ({
  readProgressPhoto: vi.fn(),
}));

const older = {
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-01-02T12:00:00.000Z',
  contentType: 'image/jpeg' as const,
  width: 8,
  height: 8,
};
const newer = {
  id: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-06-03T12:00:00.000Z',
  contentType: 'image/jpeg' as const,
  width: 8,
  height: 8,
};

function renderPhotos(
  props: Partial<React.ComponentProps<typeof ProgressPhotos>> = {},
) {
  return render(
    <Providers>
      <I18nTestProvider>
        <ProgressPhotos loading={false} error={false} photos={[]} {...props} />
      </I18nTestProvider>
    </Providers>,
  );
}

describe('ProgressPhotos', () => {
  beforeEach(() => {
    cleanup();
    usersApi.getProgressPhotoBlob
      .mockReset()
      .mockResolvedValue(new Blob(['photo'], { type: 'image/jpeg' }));
    usersApi.deleteProgressPhoto.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows an empty gallery and keeps comparison unavailable', () => {
    renderPhotos();
    expect(screen.getByText('Фото ще немає.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Порівняти' })).toBeDisabled();
  });

  it('shows the load error and a loading placeholder', () => {
    const { rerender } = renderPhotos({ error: true });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Не вдалося завантажити фото.',
    );

    rerender(
      <Providers>
        <I18nTestProvider>
          <ProgressPhotos loading error={false} photos={[]} />
        </I18nTestProvider>
      </Providers>,
    );
    expect(screen.queryByLabelText('Додати фото')).not.toBeInTheDocument();
  });

  it('shows the load error inside the viewer when the image fails', async () => {
    const user = userEvent.setup();
    usersApi.getProgressPhotoBlob.mockRejectedValue(new Error('missing'));
    renderPhotos({ photos: [older] });
    await user.click(
      await screen.findByRole('button', { name: /02\.01\.2026/ }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Не вдалося завантажити це фото.',
    );
  });

  it('shows the photo again after a later load succeeds', async () => {
    usersApi.getProgressPhotoBlob.mockRejectedValueOnce(new Error('missing'));
    const { rerender } = renderPhotos({ photos: [older] });
    expect(
      await screen.findByText('Не вдалося завантажити це фото.'),
    ).toBeInTheDocument();

    rerender(
      <Providers>
        <I18nTestProvider>
          <ProgressPhotos
            loading={false}
            error={false}
            photos={[{ ...older }]}
          />
        </I18nTestProvider>
      </Providers>,
    );

    await waitFor(() => {
      expect(
        screen.queryByText('Не вдалося завантажити це фото.'),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /02\.01\.2026/ }).querySelector('img'),
    ).toHaveAttribute('src', 'blob:photo');
  });

  it('opens and closes the full-size photo', async () => {
    const user = userEvent.setup();
    renderPhotos({ photos: [older] });
    await user.click(
      await screen.findByRole('button', { name: /02\.01\.2026/ }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByRole('img', { name: /02\.01\.2026/ }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Закрити' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('compares two different photos and ignores a repeated selection', async () => {
    const user = userEvent.setup();
    renderPhotos({ photos: [newer, older] });
    await user.click(screen.getByRole('button', { name: 'Порівняти' }));
    const olderButton = screen.getByRole('button', { name: /02\.01\.2026/ });
    await user.click(olderButton);
    await user.click(olderButton);
    expect(olderButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(olderButton);
    await user.click(screen.getByRole('button', { name: /03\.06\.2026/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('До')).toBeInTheDocument();
    expect(within(dialog).getByText('Після')).toBeInTheDocument();
    expect(within(dialog).getByText(/02\.01\.2026/)).toBeInTheDocument();
    expect(within(dialog).getByText(/03\.06\.2026/)).toBeInTheDocument();
  });

  it('asks before deleting and keeps the photo when deletion fails', async () => {
    const user = userEvent.setup();
    usersApi.deleteProgressPhoto.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'nope'),
    );
    renderPhotos({ photos: [older] });
    await user.click(
      await screen.findByRole('button', { name: /02\.01\.2026/ }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Видалити фото' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }));
    expect(usersApi.deleteProgressPhoto).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole('button', { name: 'Видалити фото' }),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Видалити фото' }),
    );
    expect(usersApi.deleteProgressPhoto).toHaveBeenCalledWith(older.id);
    expect(
      await screen.findByText('Не вдалося видалити фото.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { hidden: true, name: /02\.01\.2026/ }),
    ).toBeInTheDocument();
  });

  it('closes the viewer after the server deletes the photo', async () => {
    const user = userEvent.setup();
    const view = renderPhotos({ photos: [older, newer] });
    await user.click(
      await screen.findByRole('button', { name: /02\.01\.2026/ }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Видалити фото' }),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Видалити фото' }),
    );
    expect(usersApi.deleteProgressPhoto).toHaveBeenCalledWith(older.id);
    expect(screen.queryByText('Фото видалено')).not.toBeInTheDocument();

    view.rerender(
      <Providers>
        <I18nTestProvider>
          <ProgressPhotos loading={false} error={false} photos={[newer]} />
        </I18nTestProvider>
      </Providers>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /02\.01\.2026/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /03\.06\.2026/ }),
    ).toBeInTheDocument();
  });

  it('shows the eight-photo limit instead of another upload', () => {
    renderPhotos({
      photos: Array.from({ length: 8 }, (_, index) => ({
        ...older,
        id: `11111111-1111-4111-8111-11111111111${index}`,
      })),
    });
    expect(
      screen.getByText('Можна зберегти не більше 8 фото.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Додати фото')).not.toBeInTheDocument();
  });
});
