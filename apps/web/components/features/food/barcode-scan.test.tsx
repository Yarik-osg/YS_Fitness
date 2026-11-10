import type { FoodProductResponse } from '@repo/shared-types';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { AddFoodSheet } from './add-food-sheet';
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';

const foodApi = vi.hoisted(() => ({
  searchFoods: vi.fn(),
  createFoodLog: vi.fn(),
  createFoodProduct: vi.fn(),
  listCustomFoods: vi.fn(),
  listFavoriteFoods: vi.fn(),
  listRecentFoods: vi.fn(),
  favoriteFood: vi.fn(),
  unfavoriteFood: vi.fn(),
  getFoodDay: vi.fn(),
  updateFoodLog: vi.fn(),
  deleteFoodLog: vi.fn(),
}));

vi.mock('@/lib/api/food', () => foodApi);
const navigation = vi.hoisted(() => ({ path: '/nutrition' }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => navigation.path,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const milk: FoodProductResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  source: 'OFF',
  externalId: '4006381333931',
  barcode: '4006381333931',
  name: 'Milk',
  brand: null,
  imageUrl: null,
  kcalPer100g: 50,
  proteinPer100g: 3,
  fatPer100g: 2,
  carbsPer100g: 5,
  isFavorite: false,
};

const code = '4006381333931';

function renderSheet() {
  return render(
    <Providers>
      <I18nTestProvider locale="en">
        <AddFoodSheet
          open
          meal="LUNCH"
          loggedOn="2026-11-06"
          onClose={vi.fn()}
        />
      </I18nTestProvider>
    </Providers>,
  );
}

function camera(reject?: DOMException) {
  const track = {
    stop: vi.fn(),
    getCapabilities: () => ({}),
    applyConstraints: vi.fn(),
  };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
  const getUserMedia = reject
    ? vi.fn().mockRejectedValue(reject)
    : vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  class Detector {
    static getSupportedFormats() {
      return Promise.resolve(['ean_13', 'ean_8', 'upc_a']);
    }

    detect() {
      return Promise.resolve([]);
    }
  }
  vi.stubGlobal('BarcodeDetector', Detector);
  return { track, getUserMedia };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  navigation.path = '/nutrition';
});

describe('typed barcode search', () => {
  it('looks up a valid barcode and does not run a text search', async () => {
    const user = userEvent.setup();
    foodApi.searchFoods.mockResolvedValue({
      products: [milk],
      fromCacheOnly: false,
    });
    renderSheet();
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      code,
    );
    expect(await screen.findByRole('textbox', { name: 'Grams' })).toHaveValue(
      '100',
    );
    expect(screen.getByRole('combobox', { name: 'Meal' })).toHaveValue('LUNCH');
    expect(foodApi.searchFoods).toHaveBeenCalledWith(
      { barcode: code },
      expect.any(AbortSignal),
    );
    expect(
      foodApi.searchFoods.mock.calls.some(
        (call) =>
          typeof call[0] === 'object' && call[0] !== null && 'q' in call[0],
      ),
    ).toBe(false);
  });

  it('offers to create a product when the barcode is unknown', async () => {
    const user = userEvent.setup();
    foodApi.searchFoods.mockResolvedValue({
      products: [],
      fromCacheOnly: false,
    });
    renderSheet();
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      code,
    );
    expect(await screen.findByText('Product not found.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create product' }));
    const field = screen.getByRole('textbox', { name: 'Barcode' });
    expect(field).toHaveValue(code);
    expect(field).toHaveAttribute('readonly');
  });

  it('does not say the product is missing when the catalog could not be checked', async () => {
    const user = userEvent.setup();
    foodApi.searchFoods.mockResolvedValue({
      products: [],
      fromCacheOnly: true,
    });
    renderSheet();
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      code,
    );
    expect(
      await screen.findByText(
        'The online catalog could not be checked right now.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Product not found.')).not.toBeInTheDocument();
  });

  it('lets a failed lookup be retried', async () => {
    const user = userEvent.setup();
    foodApi.searchFoods.mockRejectedValueOnce(
      new ApiClientError(429, 'TOO_MANY_REQUESTS', 'slow'),
    );
    renderSheet();
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      code,
    );
    expect(
      await screen.findByText(
        'Too many searches. Wait a minute and try again.',
      ),
    ).toBeInTheDocument();
    foodApi.searchFoods.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('The lookup failed. Try again.'),
    ).toBeInTheDocument();
  });
});

describe('BarcodeScanner camera', () => {
  it('keeps manual entry available when permission is denied', async () => {
    const user = userEvent.setup();
    camera(new DOMException('blocked', 'NotAllowedError'));
    foodApi.searchFoods.mockResolvedValue({
      products: [milk],
      fromCacheOnly: false,
    });
    renderSheet();
    await user.click(screen.getByRole('button', { name: 'Scan barcode' }));
    expect(
      await screen.findByText(
        'The camera is blocked. Type the barcode or choose a photo.',
      ),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Type the barcode' }),
      {
        target: { value: code },
      },
    );
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(
      await screen.findByRole('textbox', { name: 'Grams' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Meal' })).toHaveValue('LUNCH');
  });

  it('replaces the camera with the miss', async () => {
    const user = userEvent.setup();
    camera(new DOMException('blocked', 'NotAllowedError'));
    foodApi.searchFoods.mockResolvedValue({
      products: [],
      fromCacheOnly: false,
    });
    renderSheet();
    await user.click(screen.getByRole('button', { name: 'Scan barcode' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Type the barcode' }),
      {
        target: { value: code },
      },
    );
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText('Product not found.')).toBeInTheDocument();
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });

  it('keeps the barcode field focused and hides the search form', async () => {
    const user = userEvent.setup();
    camera(new DOMException('blocked', 'NotAllowedError'));
    const view = renderSheet();
    await user.click(screen.getByRole('button', { name: 'Scan barcode' }));
    const field = await screen.findByRole('textbox', {
      name: 'Type the barcode',
    });
    field.focus();
    view.rerender(
      <Providers>
        <I18nTestProvider locale="en">
          <AddFoodSheet
            open
            meal="LUNCH"
            loggedOn="2026-11-06"
            onClose={vi.fn()}
          />
        </I18nTestProvider>
      </Providers>,
    );
    expect(document.activeElement).toBe(field);
    expect(
      screen.queryByRole('textbox', { name: 'Search foods' }),
    ).not.toBeInTheDocument();
  });

  it('clears the photo input so the same picture can be chosen again', async () => {
    const user = userEvent.setup();
    camera(new DOMException('blocked', 'NotAllowedError'));
    renderSheet();
    await user.click(screen.getByRole('button', { name: 'Scan barcode' }));
    const input = await screen.findByLabelText('Scan from photo');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'label.jpg', { type: 'image/jpeg' })] },
    });
    expect(input).toHaveValue('');
  });
});

function ScannerProbe({ active }: { active: boolean }) {
  const scanner = useBarcodeScanner(active, vi.fn());
  return (
    <>
      <p>{scanner.phase}</p>
      <button
        type="button"
        aria-pressed={scanner.torch}
        disabled={!scanner.canTorch}
        onClick={() => void scanner.toggleTorch()}
      >
        torch
      </button>
    </>
  );
}

describe('useBarcodeScanner', () => {
  function renderProbe(active: boolean) {
    return render(
      <I18nTestProvider locale="en">
        <ScannerProbe active={active} />
      </I18nTestProvider>,
    );
  }

  it('stops every track when the scanner closes or unmounts', async () => {
    const { track, getUserMedia } = camera();
    const view = renderProbe(true);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    view.rerender(
      <I18nTestProvider locale="en">
        <ScannerProbe active={false} />
      </I18nTestProvider>,
    );
    await waitFor(() => expect(track.stop).toHaveBeenCalled());
    track.stop.mockClear();
    view.rerender(
      <I18nTestProvider locale="en">
        <ScannerProbe active />
      </I18nTestProvider>,
    );
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    view.unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it('turns the torch control off when the device rejects it', async () => {
    const user = userEvent.setup();
    const applyConstraints = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('torch unavailable'));
    const track = {
      stop: vi.fn(),
      getCapabilities: () => ({ torch: true }),
      applyConstraints,
    };
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        }),
      },
    });
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        static getSupportedFormats() {
          return Promise.resolve(['ean_13', 'ean_8', 'upc_a']);
        }

        detect() {
          return Promise.resolve([]);
        }
      },
    );
    renderProbe(true);
    const button = await screen.findByRole('button', { name: 'torch' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    await user.click(button);
    await waitFor(() =>
      expect(button).toHaveAttribute('aria-pressed', 'false'),
    );
  });

  it('stops every track when the tab is hidden or the route changes', async () => {
    const { track, getUserMedia } = camera();
    const view = renderProbe(true);
    await waitFor(() =>
      expect(screen.getByText('scanning')).toBeInTheDocument(),
    );
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(track.stop).toHaveBeenCalled());
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    track.stop.mockClear();
    navigation.path = '/profile';
    view.rerender(
      <I18nTestProvider locale="en">
        <ScannerProbe active />
      </I18nTestProvider>,
    );
    await waitFor(() => expect(screen.getByText('paused')).toBeInTheDocument());
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
