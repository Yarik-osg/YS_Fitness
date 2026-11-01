import { describe, expect, it } from 'vitest';
import {
  mealCountFromBand,
  nutritionActivityFromDailyActivity,
  nutritionGoalFromMainGoal,
  nutritionGoalFromTrainingGoal,
} from './nutrition-from-onboarding.js';

describe('nutrition inputs from onboarding', () => {
  it('maps the four onboarding slider stops onto the four formula levels', () => {
    expect(nutritionActivityFromDailyActivity('SEDENTARY')).toBe('SEDENTARY');
    expect(nutritionActivityFromDailyActivity('LIGHTLY_ACTIVE')).toBe(
      'MODERATE',
    );
    expect(nutritionActivityFromDailyActivity('MODERATELY_ACTIVE')).toBe(
      'HIGH',
    );
    expect(nutritionActivityFromDailyActivity('VERY_ACTIVE')).toBe('VERY_HIGH');
    expect(() => nutritionActivityFromDailyActivity('EXTRA_ACTIVE')).toThrow(
      'activity level is not one of the four formula levels',
    );
  });

  it('maps each onboarding main goal onto a formula goal', () => {
    expect(nutritionGoalFromMainGoal('LOSE_WEIGHT')).toBe('LOSE_WEIGHT');
    expect(nutritionGoalFromMainGoal('MAINTAIN')).toBe('MAINTAIN');
    expect(nutritionGoalFromMainGoal('IMPROVE_BODY')).toBe('RECOMPOSITION');
    expect(nutritionGoalFromMainGoal('BUILD_MUSCLE')).toBe('GAIN_MUSCLE');
    expect(nutritionGoalFromMainGoal('GET_STRONGER')).toBe('GAIN_MUSCLE');
  });

  it('maps improve body to recomposition and the other training goals as stored', () => {
    expect(
      nutritionGoalFromTrainingGoal('MAINTAIN_WEIGHT', 'IMPROVE_BODY'),
    ).toBe('RECOMPOSITION');
    expect(nutritionGoalFromTrainingGoal('LOSE_WEIGHT')).toBe('LOSE_WEIGHT');
    expect(nutritionGoalFromTrainingGoal('MAINTAIN_WEIGHT', 'MAINTAIN')).toBe(
      'MAINTAIN',
    );
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
