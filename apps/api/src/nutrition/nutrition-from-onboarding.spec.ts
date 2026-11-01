import { describe, expect, it } from 'vitest';
import {
  mealCountFromBand,
  nutritionActivityFromDailyActivity,
  nutritionGoalFromTrainingGoal,
} from './nutrition-from-onboarding.js';

describe('nutrition inputs from onboarding', () => {
  it('folds the five daily activity levels into the four formula levels', () => {
    expect(nutritionActivityFromDailyActivity('SEDENTARY')).toBe('SEDENTARY');
    expect(nutritionActivityFromDailyActivity('LIGHTLY_ACTIVE')).toBe(
      'SEDENTARY',
    );
    expect(nutritionActivityFromDailyActivity('MODERATELY_ACTIVE')).toBe(
      'MODERATE',
    );
    expect(nutritionActivityFromDailyActivity('VERY_ACTIVE')).toBe('HIGH');
    expect(nutritionActivityFromDailyActivity('EXTRA_ACTIVE')).toBe(
      'VERY_HIGH',
    );
  });

  it('uses the stored training goal and does not invent recomposition', () => {
    expect(nutritionGoalFromTrainingGoal('LOSE_WEIGHT')).toBe('LOSE_WEIGHT');
    expect(nutritionGoalFromTrainingGoal('MAINTAIN_WEIGHT')).toBe('MAINTAIN');
    expect(nutritionGoalFromTrainingGoal('GAIN_WEIGHT')).toBe('GAIN_MUSCLE');
  });

  it('turns a meal band into a profile count', () => {
    expect(mealCountFromBand('1-2')).toBe(2);
    expect(mealCountFromBand('4-5')).toBe(4);
    expect(mealCountFromBand('6+')).toBe(6);
    expect(mealCountFromBand('no_schedule')).toBe(3);
    expect(mealCountFromBand('varies')).toBe(3);
  });
});
