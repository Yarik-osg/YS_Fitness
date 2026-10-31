import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  calculateNutrition,
  NutritionCalculationInput,
  NutritionInputError,
} from './nutrition-calculation.js';

const woman = {
  sex: 'FEMALE',
  weightKg: '60',
  heightCm: '165',
  ageYears: 30,
  activity: 'MODERATE',
  frequency: 3,
  goal: 'LOSE_WEIGHT',
} as const satisfies NutritionCalculationInput;

function expectUnsupported(overrides: Record<string, unknown>) {
  let caught: unknown;
  try {
    calculateNutrition({ ...woman, ...overrides } as NutritionCalculationInput);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(NutritionInputError);
  expect((caught as NutritionInputError).code).toBe(
    'NUTRITION_INPUT_UNSUPPORTED',
  );
}

describe('calculateNutrition', () => {
  it('calculates a woman from BMR through the leftover carbohydrates', () => {
    const result = calculateNutrition(woman);

    expect(result.bmr.equals('1320.25')).toBe(true);
    expect(result.activityMultiplier.equals('1.55')).toBe(true);
    expect(result.goalAdjustment.equals('-0.15')).toBe(true);
    expect(result.tdee.equals('2046.3875')).toBe(true);
    expect(result.targetCalories.equals('1739.429375')).toBe(true);
    expect(result.proteinGrams.equals('120')).toBe(true);
    expect(result.fatGrams.equals('54')).toBe(true);
    expect(result.carbsGrams.equals('193.35734375')).toBe(true);
    expect(result.carbsNonPositive).toBe(false);
  });

  it('uses +5 for a man and -161 for a woman', () => {
    const female = calculateNutrition(woman);
    const male = calculateNutrition({ ...woman, sex: 'MALE' });

    expect(male.bmr.minus(female.bmr).equals('166')).toBe(true);
    expect(male.bmr.equals('1486.25')).toBe(true);
  });

  it.each([
    ['SEDENTARY', 2, '1.35'],
    ['SEDENTARY', 3, '1.40'],
    ['SEDENTARY', 4, '1.45'],
    ['MODERATE', 2, '1.50'],
    ['MODERATE', 3, '1.55'],
    ['MODERATE', 4, '1.60'],
    ['HIGH', 2, '1.65'],
    ['HIGH', 3, '1.70'],
    ['HIGH', 4, '1.75'],
    ['VERY_HIGH', 2, '1.80'],
    ['VERY_HIGH', 3, '1.85'],
    ['VERY_HIGH', 4, '1.90'],
  ] as const)(
    'uses activity %s with %s workouts at %s',
    (activity, frequency, multiplier) => {
      const result = calculateNutrition({ ...woman, activity, frequency });
      expect(result.activityMultiplier.equals(multiplier)).toBe(true);
      expect(result.tdee.equals(result.bmr.mul(multiplier))).toBe(true);
    },
  );

  it.each([
    ['LOSE_WEIGHT', '-0.15', '2'],
    ['MAINTAIN', '0', '1.6'],
    ['GAIN_MUSCLE', '0.075', '1.8'],
    ['RECOMPOSITION', '0', '2'],
  ] as const)(
    'applies %s as %s and %s g/kg protein',
    (goal, adjustment, proteinPerKg) => {
      const result = calculateNutrition({ ...woman, goal });
      expect(result.goalAdjustment.equals(adjustment)).toBe(true);
      expect(
        result.proteinGrams.equals(new Prisma.Decimal('60').mul(proteinPerKg)),
      ).toBe(true);
      expect(result.fatGrams.equals('54')).toBe(true);
    },
  );

  it('applies the 7.5% muscle-gain factor to the calorie target', () => {
    const result = calculateNutrition({ ...woman, goal: 'GAIN_MUSCLE' });

    expect(result.tdee.equals('2046.3875')).toBe(true);
    expect(result.targetCalories.equals('2199.8665625')).toBe(true);
    expect(result.proteinGrams.equals('108')).toBe(true);
  });

  it('keeps a non-positive carbohydrate result instead of clamping it', () => {
    const result = calculateNutrition({
      sex: 'FEMALE',
      weightKg: '40',
      heightCm: '100',
      ageYears: 90,
      activity: 'SEDENTARY',
      frequency: 2,
      goal: 'LOSE_WEIGHT',
    });

    expect(result.carbsGrams.equals('-42.23375')).toBe(true);
    expect(result.carbsNonPositive).toBe(true);
    expect(result.targetCalories.equals('475.065')).toBe(true);
  });

  it.each([
    ['LIGHTLY_ACTIVE', 3, 'LOSE_WEIGHT'],
    ['EXTRA_ACTIVE', 3, 'LOSE_WEIGHT'],
    ['MODERATELY_ACTIVE', 3, 'LOSE_WEIGHT'],
    ['VERY_ACTIVE', 3, 'LOSE_WEIGHT'],
    ['SEDENTARY', 1, 'LOSE_WEIGHT'],
    ['SEDENTARY', 5, 'LOSE_WEIGHT'],
    ['SEDENTARY', 3, 'MAINTAIN_WEIGHT'],
    ['SEDENTARY', 3, 'GAIN_WEIGHT'],
    ['SEDENTARY', 3, 'lose_weight'],
    ['SEDENTARY', 3, 'maintain'],
    ['SEDENTARY', 3, 'improve_body'],
    ['SEDENTARY', 3, 'build_muscle'],
    ['SEDENTARY', 3, 'get_stronger'],
  ])('rejects training value %s / %s / %s', (activity, frequency, goal) => {
    expectUnsupported({ activity, frequency, goal });
  });

  it('rejects a non-positive body size, a zero age, and a string frequency', () => {
    expectUnsupported({ weightKg: '0' });
    expectUnsupported({ heightCm: '-1' });
    expectUnsupported({ ageYears: 0 });
    expectUnsupported({ frequency: '3' });
  });
});
