import type {
  FoodDayResponse,
  FoodProductResponse,
  FoodRecentResponse,
} from '@repo/shared-types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { FoodPage } from './food-page';

const foodApi = vi.hoisted(() => ({
  getFoodDay: vi.fn(),
  searchFoods: vi.fn(),
  createFoodLog: vi.fn(),
  updateFoodLog: vi.fn(),
  deleteFoodLog: vi.fn(),
  listFavoriteFoods: vi.fn(),
  listRecentFoods: vi.fn(),
  favoriteFood: vi.fn(),
  unfavoriteFood: vi.fn(),
  createFoodProduct: vi.fn(),
}));

vi.mock('@/lib/api/food', () => foodApi);
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('date=2026-11-06'),
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
  usePathname: () => '/food',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const milk: FoodProductResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  source: 'OFF',
  externalId: '123',
  name: 'Milk',
  brand: 'Farm',
  imageUrl: null,
  kcalPer100g: 50,
  proteinPer100g: 3,
  fatPer100g: 2,
  carbsPer100g: 5,
  isFavorite: false,
};

const emptyDay: FoodDayResponse = {
  date: '2026-11-06',
  entries: [],
  totals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  target: {
    source: 'CALCULATED',
    targetCalories: 2000,
    proteinGrams: 150,
    fatGrams: 60,
    carbsGrams: 200,
  },
  remaining: { kcal: 2000, protein: 150, fat: 60, carbs: 200 },
};

function renderPage() {
  return render(
    <Providers>
      <I18nTestProvider locale="en">
        <FoodPage />
      </I18nTestProvider>
    </Providers>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FoodPage', () => {
  it('adds a searched food and shows it on the day', async () => {
    const user = userEvent.setup();
    const logged = {
      ...emptyDay,
      entries: [
        {
          id: 'entry-1',
          productId: milk.id,
          loggedOn: '2026-11-06',
          meal: 'BREAKFAST' as const,
          grams: 100,
          productName: 'Milk',
          imageUrl: null,
          kcal: 50,
          protein: 3,
          fat: 2,
          carbs: 5,
          createdAt: '2026-11-06T08:00:00.000Z',
        },
      ],
      totals: { kcal: 50, protein: 3, fat: 2, carbs: 5 },
      remaining: { kcal: 1950, protein: 147, fat: 58, carbs: 195 },
    };
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.searchFoods.mockResolvedValue({
      products: [milk],
      fromCacheOnly: false,
    });
    foodApi.createFoodLog.mockImplementation(async () => {
      foodApi.getFoodDay.mockResolvedValue(logged);
      return logged.entries[0];
    });
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      'milk',
    );
    await user.click(await screen.findByRole('button', { name: /^Milk/ }));
    expect(screen.getByRole('textbox', { name: 'Grams' })).toHaveValue('100');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(foodApi.createFoodLog).toHaveBeenCalledWith({
      productId: milk.id,
      grams: 100,
      meal: 'BREAKFAST',
      loggedOn: '2026-11-06',
    });
  });

  it('rolls a favorite back when the request fails', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.searchFoods.mockResolvedValue({
      products: [milk],
      fromCacheOnly: false,
    });
    let rejectFavorite: (error: unknown) => void = () => undefined;
    foodApi.favoriteFood.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectFavorite = reject;
        }),
    );
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      'milk',
    );
    const heart = await screen.findByRole('button', { name: 'Favorite Milk' });
    await user.click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    rejectFavorite(new ApiClientError(500, 'HTTP_ERROR', 'down'));
    await waitFor(() => {
      expect(heart).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('prefills recent grams and meal for add again', async () => {
    const user = userEvent.setup();
    const recent: FoodRecentResponse = {
      items: [
        {
          product: milk,
          lastGrams: 80,
          lastMeal: 'SNACK',
          lastLoggedOn: '2026-11-05',
        },
      ],
    };
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.listRecentFoods.mockResolvedValue(recent);
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.click(screen.getByRole('button', { name: 'Recent' }));
    await user.click(await screen.findByRole('button', { name: 'Add again' }));
    expect(screen.getByRole('textbox', { name: 'Grams' })).toHaveValue('80');
    expect(screen.getByRole('combobox', { name: 'Meal' })).toHaveValue('SNACK');
  });

  it('maps a too-large edit and a server cap error', async () => {
    const user = userEvent.setup();
    const entry = {
      id: 'entry-1',
      productId: milk.id,
      loggedOn: '2026-11-06',
      meal: 'BREAKFAST' as const,
      grams: 100,
      productName: 'Milk',
      imageUrl: null,
      kcal: 50,
      protein: 3,
      fat: 2,
      carbs: 5,
      createdAt: '2026-11-06T08:00:00.000Z',
    };
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      entries: [entry],
      totals: { kcal: 50, protein: 3, fat: 2, carbs: 5 },
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const kcal = screen.getByRole('textbox', { name: 'Calories' });
    await user.clear(kcal);
    await user.type(kcal, '99999');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(foodApi.updateFoodLog).not.toHaveBeenCalled();
    expect(
      screen.getByText('That amount is too large for these grams.'),
    ).toBeInTheDocument();

    await user.clear(kcal);
    await user.type(kcal, '50');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Meal' }),
      'DINNER',
    );
    foodApi.updateFoodLog.mockRejectedValue(
      new ApiClientError(
        400,
        'FOOD_VALUES_OUT_OF_RANGE',
        'Food values are too large for this amount',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That amount is too large for these grams.',
    );
  });

  it('shows the locked screen without a subscription', async () => {
    foodApi.getFoodDay.mockRejectedValue(
      new ApiClientError(
        403,
        'SUBSCRIPTION_REQUIRED',
        'An active subscription is required',
      ),
    );
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'No active plan' }),
    ).toBeInTheDocument();
  });

  it('notes an incomplete search and a rate limit', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.searchFoods.mockResolvedValueOnce({
      products: [milk],
      fromCacheOnly: true,
    });
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      'milk',
    );
    expect(
      await screen.findByText('These results may be incomplete right now.'),
    ).toBeInTheDocument();

    foodApi.searchFoods.mockRejectedValue(
      new ApiClientError(429, 'TOO_MANY_REQUESTS', 'slow'),
    );
    await user.type(screen.getByRole('textbox', { name: 'Search foods' }), 's');
    expect(
      await screen.findByText(
        'Too many searches. Wait a minute and try again.',
      ),
    ).toBeInTheDocument();
  });
});
