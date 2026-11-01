import type {
  ActivityLevel,
  NutritionActivity,
  NutritionGoal,
  WeightGoal,
} from '@repo/shared-types';

/**
 * Onboarding asks five daily-activity levels and the formula has four.
 * Lightly active sits with sedentary. Extra active sits with very high.
 */
export function nutritionActivityFromDailyActivity(
  level: ActivityLevel,
): NutritionActivity {
  switch (level) {
    case 'SEDENTARY':
    case 'LIGHTLY_ACTIVE':
      return 'SEDENTARY';
    case 'MODERATELY_ACTIVE':
      return 'MODERATE';
    case 'VERY_ACTIVE':
      return 'HIGH';
    case 'EXTRA_ACTIVE':
      return 'VERY_HIGH';
  }
}

/** Recomposition is not an onboarding answer. Gaining weight uses the muscle goal. */
export function nutritionGoalFromTrainingGoal(goal: WeightGoal): NutritionGoal {
  switch (goal) {
    case 'LOSE_WEIGHT':
      return 'LOSE_WEIGHT';
    case 'MAINTAIN_WEIGHT':
      return 'MAINTAIN';
    case 'GAIN_WEIGHT':
      return 'GAIN_MUSCLE';
  }
}

/** The formula ignores this. The profile row still needs an integer 1–8. */
export function mealCountFromBand(band: string | null | undefined): number {
  switch (band) {
    case '1-2':
      return 2;
    case '3':
      return 3;
    case '4':
      return 4;
    case '4-5':
      return 4;
    case '5+':
      return 5;
    case '6+':
      return 6;
    default:
      return 3;
  }
}
