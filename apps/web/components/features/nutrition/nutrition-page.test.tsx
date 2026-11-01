import type { NutritionCalculationResponse } from '@repo/shared-types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { NutritionPage } from './nutrition-page';

const nutritionApi = vi.hoisted(() => ({
  listNutritionCalculations: vi.fn(),
  calculateNutrition: vi.fn(),
}));

vi.mock('@/lib/api/nutrition', () => nutritionApi);
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
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const calculation: NutritionCalculationResponse = {
  id: 'calc-1',
  weightKg: '60',
  heightCm: '165',
  ageYears: 30,
  sex: 'FEMALE',
  activity: 'MODERATE',
  frequency: 3,
  goal: 'LOSE_WEIGHT',
  activityMultiplier: '1.55',
  goalAdjustment: '-0.15',
  bmr: '1320.25',
  tdee: '2046.3875',
  targetCalories: '1739.429375',
  proteinGrams: '120',
  fatGrams: '54',
  carbsGrams: '193.35734375',
  carbsNonPositive: false,
  createdAt: '2026-11-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <Providers>
      <I18nTestProvider locale="en">
        <NutritionPage />
      </I18nTestProvider>
    </Providers>,
  );
}

describe('NutritionPage', () => {
  beforeEach(() => {
    nutritionApi.listNutritionCalculations.mockResolvedValue({
      calculations: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('links nutrition in the client nav', async () => {
    renderPage();

    expect(
      await screen.findByRole('link', { name: 'Nutrition' }),
    ).toHaveAttribute('href', '/nutrition');
  });

  it('shows the unsupported state when onboarding cannot be calculated', async () => {
    nutritionApi.calculateNutrition.mockRejectedValue(
      new ApiClientError(400, 'NUTRITION_INPUT_UNSUPPORTED', 'missing weight'),
    );
    renderPage();

    expect(
      await screen.findByText(
        'Calories cannot be calculated until your profile has weight, height, age, and workouts per week.',
      ),
    ).toBeInTheDocument();
    expect(nutritionApi.calculateNutrition).toHaveBeenCalledOnce();
    expect(screen.queryByText('1739')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calculate' })).toBeNull();
  });

  it('shows the breakdown labels for the latest calculation', async () => {
    nutritionApi.listNutritionCalculations.mockResolvedValue({
      calculations: [calculation],
    });
    renderPage();

    expect(await screen.findByText('1739')).toBeInTheDocument();
    expect(screen.getByText('kcal')).toBeInTheDocument();
    expect(screen.getByText('per day')).toBeInTheDocument();
    expect(screen.getByText('Protein')).toBeInTheDocument();
    expect(screen.getByText('Fat')).toBeInTheDocument();
    expect(screen.getByText('Carbs')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('54')).toBeInTheDocument();
    expect(screen.getByText('193')).toBeInTheDocument();
    expect(screen.getByText('A menu for your macros')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    await waitFor(() => {
      expect(nutritionApi.calculateNutrition).not.toHaveBeenCalled();
    });
  });
});
