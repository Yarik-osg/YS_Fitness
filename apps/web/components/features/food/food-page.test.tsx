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
  listCustomFoods: vi.fn(),
  listFavoriteFoods: vi.fn(),
  listRecentFoods: vi.fn(),
  favoriteFood: vi.fn(),
  unfavoriteFood: vi.fn(),
  createFoodProduct: vi.fn(),
}));

vi.mock('@/lib/api/food', () => foodApi);
const nutritionApi = vi.hoisted(() => ({
  listNutritionCalculations: vi.fn(),
  calculateNutrition: vi.fn(),
}));
vi.mock('@/lib/api/nutrition', () => nutritionApi);
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
}));

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
  usePathname: () => '/nutrition',
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
}));

const milk: FoodProductResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  source: 'OFF',
  externalId: '123',
  barcode: null,
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
          isFavorite: false,
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

  it('keeps two-decimal grams off the request and shows a failed save', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.searchFoods.mockResolvedValue({
      products: [milk],
      fromCacheOnly: false,
    });
    foodApi.createFoodLog.mockRejectedValue(
      new ApiClientError(400, 'VALIDATION_ERROR', 'Grams are invalid'),
    );
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      'milk',
    );
    await user.click(await screen.findByRole('button', { name: /^Milk/ }));
    const grams = screen.getByRole('textbox', { name: 'Grams' });
    await user.clear(grams);
    await user.type(grams, '10.25');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(
      screen.getByText('Enter grams from 0.1 to 5000, with one decimal.'),
    ).toBeInTheDocument();
    await user.clear(grams);
    await user.type(grams, '100');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Grams are invalid',
    );
    expect(foodApi.createFoodLog).toHaveBeenCalledTimes(1);
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
      isFavorite: false,
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
    await user.click(await screen.findByRole('button', { name: 'Edit Milk' }));
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

  it('shows eaten calories, an overrun, and a day without a target', async () => {
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      totals: { kcal: 2100, protein: 160, fat: 70, carbs: 220 },
      remaining: { kcal: -100, protein: -10, fat: -10, carbs: -20 },
    });
    const { unmount } = renderPage();
    expect(await screen.findByText('2,100')).toBeInTheDocument();
    expect(screen.getByText('Over by 100')).toBeInTheDocument();
    unmount();

    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      target: null,
      remaining: null,
      totals: { kcal: 50, protein: 3, fat: 2, carbs: 5 },
    });
    nutritionApi.listNutritionCalculations.mockResolvedValue({
      calculations: [
        {
          id: 'calc-1',
          status: 'REQUIRES_REVIEW',
          targetCalories: '1200',
          proteinGrams: '80',
          fatGrams: '40',
          carbsGrams: '100',
        },
      ],
      target: null,
    });
    renderPage();
    expect(await screen.findByText('50')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'The automatic calculation needs a trainer to check it. It is not shown as your target yet.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('A target appears once nutrition has one.'),
    ).not.toBeInTheDocument();
    expect(nutritionApi.calculateNutrition).not.toHaveBeenCalled();
  });

  it('starts a nutrition calculation when the day has no target yet', async () => {
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      target: null,
      remaining: null,
    });
    nutritionApi.listNutritionCalculations.mockResolvedValue({
      calculations: [],
      target: null,
    });
    nutritionApi.calculateNutrition.mockResolvedValue({ id: 'calc-2' });
    renderPage();
    await waitFor(() => {
      expect(nutritionApi.calculateNutrition).toHaveBeenCalledTimes(1);
    });
  });

  it('lets a failed nutrition lookup be retried', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      target: null,
      remaining: null,
    });
    nutritionApi.listNutritionCalculations.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'down'),
    );
    renderPage();
    expect(
      await screen.findByText('Nutrition could not be loaded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    const before = nutritionApi.listNutritionCalculations.mock.calls.length;
    nutritionApi.listNutritionCalculations.mockResolvedValue({
      calculations: [],
      target: null,
    });
    nutritionApi.calculateNutrition.mockResolvedValue({ id: 'calc-3' });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(
        nutritionApi.listNutritionCalculations.mock.calls.length,
      ).toBeGreaterThan(before);
    });
  });

  it('does not promise a target when nutrition calculation fails', async () => {
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      target: null,
      remaining: null,
    });
    nutritionApi.listNutritionCalculations.mockResolvedValue({
      calculations: [],
      target: null,
    });
    nutritionApi.calculateNutrition.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'down'),
    );
    renderPage();
    expect(
      await screen.findByText('Nutrition could not be loaded.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('A target appears once nutrition has one.'),
    ).not.toBeInTheDocument();
  });

  it('asks for the previous day', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Previous day' }),
    );
    expect(navigation.replace).toHaveBeenCalledWith(
      '/nutrition?date=2026-11-05',
    );
  });

  it('explains an empty search, a failed search, and a missing photo', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      entries: [
        {
          id: 'entry-1',
          productId: milk.id,
          isFavorite: false,
          loggedOn: '2026-11-06',
          meal: 'BREAKFAST',
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
    });
    renderPage();
    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add to Breakfast' }));
    foodApi.searchFoods.mockResolvedValue({
      products: [],
      fromCacheOnly: false,
    });
    await user.type(
      screen.getByRole('textbox', { name: 'Search foods' }),
      'zz',
    );
    expect(
      await screen.findByText('No foods match that search.'),
    ).toBeInTheDocument();

    foodApi.searchFoods.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'stack trace'),
    );
    await user.type(screen.getByRole('textbox', { name: 'Search foods' }), 'z');
    expect(
      await screen.findByText('Search failed. Try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('stack trace')).not.toBeInTheDocument();
  });

  it('does not treat a failed favorites or recent list as empty', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.listFavoriteFoods.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'db'),
    );
    foodApi.listRecentFoods.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'db'),
    );
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.click(screen.getByRole('button', { name: 'Favorites' }));
    expect(
      await screen.findByText('This list could not be loaded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No favorites yet.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recent' }));
    expect(
      await screen.findByText('This list could not be loaded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No recent foods yet.')).not.toBeInTheDocument();
  });

  it('keeps a custom product form after a failed save', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.createFoodProduct.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'relation food_products'),
    );
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Create my own product' }),
    );
    expect(screen.getByPlaceholderText('Product name')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Calories per 100 g'),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Product name' }),
      'Rice',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Calories per 100 g' }),
      '130',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Protein per 100 g' }),
      '3',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Fat per 100 g' }),
      '1',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Carbs per 100 g' }),
      '28',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText('The product could not be saved. Try again.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('relation food_products'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Product name' })).toHaveValue(
      'Rice',
    );
  });

  it('shows a failed delete without removing the entry', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      entries: [
        {
          id: 'entry-1',
          productId: milk.id,
          isFavorite: false,
          loggedOn: '2026-11-06',
          meal: 'LUNCH',
          grams: 80,
          productName: 'Milk',
          imageUrl: null,
          kcal: 40,
          protein: 2,
          fat: 1,
          carbs: 4,
          createdAt: '2026-11-06T12:00:00.000Z',
        },
      ],
      totals: { kcal: 40, protein: 2, fat: 1, carbs: 4 },
    });
    foodApi.deleteFoodLog.mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'db'),
    );
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const confirms = screen.getAllByRole('button', { name: 'Delete' });
    const confirm = confirms.at(-1);
    if (!confirm) throw new Error('missing confirm');
    await user.click(confirm);
    expect(
      await screen.findByText('The entry could not be deleted. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
  });

  it('names the sheet for the meal and keeps the search after going back', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.searchFoods.mockResolvedValue({
      products: [
        {
          ...milk,
          name: 'A very long overnight oats name that should stay on two lines',
        },
      ],
      fromCacheOnly: false,
    });
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Lunch' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Add a food' }),
    ).toBeInTheDocument();
    expect(screen.getByText('For lunch')).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: 'Search foods' });
    await user.type(search, 'milk');
    const matches = await screen.findAllByRole('button', {
      name: /overnight oats/,
    });
    const card = matches.find(
      (item) => item.getAttribute('aria-pressed') === null,
    );
    const heart = matches.find(
      (item) => item.getAttribute('aria-pressed') !== null,
    );
    if (!card || !heart) throw new Error('missing product card');
    expect(card.querySelector('.line-clamp-2')).toBeTruthy();
    await user.click(heart);
    expect(
      screen.queryByRole('textbox', { name: 'Grams' }),
    ).not.toBeInTheDocument();
    await user.click(card);
    expect(screen.getByRole('textbox', { name: 'Grams' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('textbox', { name: 'Search foods' })).toHaveValue(
      'milk',
    );
  });

  it('shows a reached calorie goal', async () => {
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      totals: { kcal: 2000, protein: 150, fat: 60, carbs: 200 },
      remaining: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    });
    renderPage();
    expect(await screen.findAllByText('Goal reached')).not.toHaveLength(0);
  });

  it('favorites a food already logged on the day', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      entries: [
        {
          id: 'entry-1',
          productId: milk.id,
          isFavorite: false,
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
    });
    foodApi.favoriteFood.mockResolvedValue(undefined);
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Favorite Milk' }),
    );
    expect(foodApi.favoriteFood).toHaveBeenCalledWith(milk.id);
    expect(
      screen.getByRole('button', { name: 'Remove Milk from favorites' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByRole('textbox', { name: 'Grams' }),
    ).not.toBeInTheDocument();
  });

  it('adds one of your own foods from the mine tab', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue(emptyDay);
    foodApi.listCustomFoods.mockResolvedValue({
      products: [{ ...milk, source: 'CUSTOM', name: 'Rice' }],
    });
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add to Breakfast' }),
    );
    await user.click(screen.getByRole('button', { name: 'Mine' }));
    await user.click(await screen.findByRole('button', { name: /^Rice/ }));
    expect(screen.getByRole('textbox', { name: 'Grams' })).toHaveValue('100');
  });

  it('renames the logged food and scales only that portion', async () => {
    const user = userEvent.setup();
    foodApi.getFoodDay.mockResolvedValue({
      ...emptyDay,
      entries: [
        {
          id: 'entry-1',
          productId: milk.id,
          isFavorite: false,
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
    });
    foodApi.updateFoodLog.mockResolvedValue({});
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Milk' }));
    const name = screen.getByRole('textbox', { name: 'Product name' });
    await user.clear(name);
    await user.type(name, 'Oats');
    const portion = screen.getByRole('textbox', { name: 'Portion' });
    await user.clear(portion);
    await user.type(portion, '1.25');
    expect(screen.getByRole('textbox', { name: 'Grams' })).toHaveValue('125');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(foodApi.updateFoodLog).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({ productName: 'Oats', grams: 125, kcal: 62.5 }),
    );
  });
});
