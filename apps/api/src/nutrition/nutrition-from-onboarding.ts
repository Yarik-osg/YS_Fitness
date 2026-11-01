import type {
  ActivityLevel,
  NutritionActivity,
  NutritionGoal,
  WeightGoal,
} from '@repo/shared-types';
import { NutritionInputError } from './nutrition-calculation.js';

/** The four onboarding slider stops, in order, are the four formula rows. */
export function nutritionActivityFromDailyActivity(
  level: ActivityLevel,
): NutritionActivity {
  switch (level) {
    case 'SEDENTARY':
      return 'SEDENTARY';
    case 'LIGHTLY_ACTIVE':
      return 'MODERATE';
    case 'MODERATELY_ACTIVE':
      return 'HIGH';
    case 'VERY_ACTIVE':
      return 'VERY_HIGH';
    case 'EXTRA_ACTIVE':
      throw new NutritionInputError(
        'activity level is not one of the four formula levels',
      );
  }
}

const NUTRITION_GOAL_FROM_MAIN_GOAL: Record<string, NutritionGoal> = {
  LOSE_WEIGHT: 'LOSE_WEIGHT',
  MAINTAIN: 'MAINTAIN',
  IMPROVE_BODY: 'RECOMPOSITION',
  BUILD_MUSCLE: 'GAIN_MUSCLE',
  GET_STRONGER: 'GAIN_MUSCLE',
};

/** The onboarding main goal is the formula goal. Training goal is only a fallback. */
export function nutritionGoalFromMainGoal(mainGoal: string): NutritionGoal {
  const goal = NUTRITION_GOAL_FROM_MAIN_GOAL[mainGoal];
  if (!goal) throw new NutritionInputError('goal is not supported');
  return goal;
}

/** «Покращити якість тіла» is recomposition. A stored training goal is the fallback. */
export function nutritionGoalFromTrainingGoal(
  goal: WeightGoal,
  mainGoal?: string | null,
): NutritionGoal {
  if (mainGoal && Object.hasOwn(NUTRITION_GOAL_FROM_MAIN_GOAL, mainGoal)) {
    return nutritionGoalFromMainGoal(mainGoal);
  }
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
