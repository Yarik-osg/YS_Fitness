import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  calculateNutrition,
  NUTRITION_ALGORITHM,
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
    expect(result.activityMultiplier.equals('1.40')).toBe(true);
    expect(result.goalAdjustment.equals('-0.15')).toBe(true);
    expect(result.tdee.equals('1848.35')).toBe(true);
    expect(result.targetCalories.equals('1571.0975')).toBe(true);
    expect(result.proteinGrams.equals('132')).toBe(true);
    expect(result.fatGrams.equals('54')).toBe(true);
    expect(result.carbsGrams.equals('139.274375')).toBe(true);
    expect(result.carbsNonPositive).toBe(false);
    expect(result.status).toBe('VALID');
    expect(result.reviewReasons).toEqual([]);
    expect(result.displayCalories).toBe(1571);
    expect(result.displayProteinGrams).toBe(132);
    expect(result.displayFatGrams).toBe(54);
    expect(result.displayCarbsGrams).toBe(139);
  });

  it('ignores subjective muscle and fat appearance', () => {
    const plain = calculateNutrition(woman);
    const withAppearance = calculateNutrition({
      ...woman,
      muscleDevelopment: 100,
      bodyFatLevel: 0,
    } as NutritionCalculationInput);
    expect(withAppearance.targetCalories.equals(plain.targetCalories)).toBe(
      true,
    );
    expect(withAppearance.proteinGrams.equals(plain.proteinGrams)).toBe(true);
    expect(withAppearance.fatGrams.equals(plain.fatGrams)).toBe(true);
    expect(withAppearance.carbsGrams.equals(plain.carbsGrams)).toBe(true);
  });

  it('uses +5 for a man and -161 for a woman', () => {
    const female = calculateNutrition(woman);
    const male = calculateNutrition({ ...woman, sex: 'MALE' });

    expect(male.bmr.minus(female.bmr).equals('166')).toBe(true);
    expect(male.bmr.equals('1486.25')).toBe(true);
  });

  it.each([
    ['SEDENTARY', 2, '1.30'],
    ['SEDENTARY', 3, '1.35'],
    ['SEDENTARY', 4, '1.40'],
    ['MODERATE', 2, '1.35'],
    ['MODERATE', 3, '1.40'],
    ['MODERATE', 4, '1.45'],
    ['HIGH', 2, '1.45'],
    ['HIGH', 3, '1.50'],
    ['HIGH', 4, '1.55'],
    ['VERY_HIGH', 2, '1.55'],
    ['VERY_HIGH', 3, '1.60'],
    ['VERY_HIGH', 4, '1.65'],
  ] as const)(
    'maps stored activity %s and %s workouts to PAL %s',
    (activity, frequency, multiplier) => {
      const result = calculateNutrition({ ...woman, activity, frequency });
      expect(result.activityMultiplier.equals(multiplier)).toBe(true);
      expect(result.tdee.equals(result.bmr.mul(multiplier))).toBe(true);
    },
  );

  it.each([
    ['LOSE_WEIGHT', '0.85', '-0.15', '0.9'],
    ['MAINTAIN', '1', '0', '1.0'],
    ['GAIN_MUSCLE', '1.10', '0.10', '1.1'],
    ['RECOMPOSITION', '1', '0', '0.9'],
  ] as const)(
    'applies %s as calorie factor %s and %s g/kg fat',
    (goal, factor, adjustment, fatPerKg) => {
      const result = calculateNutrition({ ...woman, goal });
      expect(result.goalAdjustment.equals(adjustment)).toBe(true);
      expect(result.targetCalories.equals(result.tdee.mul(factor))).toBe(true);
      expect(
        result.fatGrams.equals(new Prisma.Decimal('60').mul(fatPerKg)),
      ).toBe(true);
    },
  );

  it('applies the 10% muscle-gain factor and clamps protein to 2 g/kg', () => {
    const result = calculateNutrition({ ...woman, goal: 'GAIN_MUSCLE' });

    expect(result.tdee.equals('1848.35')).toBe(true);
    expect(result.targetCalories.equals('2033.185')).toBe(true);
    expect(result.proteinGrams.equals('120')).toBe(true);
    expect(result.fatGrams.equals('66')).toBe(true);
  });

  it('clamps protein to the goal bounds for either sex', () => {
    const shared = {
      weightKg: '58',
      heightCm: '167',
      ageYears: 35,
      activity: 'HIGH',
      frequency: 3,
      goal: 'LOSE_WEIGHT',
    } as const;
    const female = calculateNutrition({ ...shared, sex: 'FEMALE' });
    const male = calculateNutrition({ ...shared, sex: 'MALE' });
    const between = calculateNutrition({
      sex: 'FEMALE',
      weightKg: '78',
      heightCm: '166',
      ageYears: 39,
      activity: 'SEDENTARY',
      frequency: 3,
      goal: 'LOSE_WEIGHT',
    });
    const minimum = calculateNutrition({
      sex: 'FEMALE',
      weightKg: '40',
      heightCm: '100',
      ageYears: 90,
      activity: 'SEDENTARY',
      frequency: 2,
      goal: 'LOSE_WEIGHT',
    });

    expect(female.proteinGrams.equals('127.6')).toBe(true);
    expect(male.proteinGrams.equals('127.6')).toBe(true);
    expect(between.proteinGrams.equals('146.743734375')).toBe(true);
    expect(minimum.proteinGrams.equals('64')).toBe(true);
  });

  it('matches the three specification examples before display rounding', () => {
    const moderateWoman = calculateNutrition({
      sex: 'FEMALE',
      weightKg: '58',
      heightCm: '167',
      ageYears: 35,
      activity: 'HIGH',
      frequency: 3,
      goal: 'LOSE_WEIGHT',
    });
    const sedentaryWoman = calculateNutrition({
      sex: 'FEMALE',
      weightKg: '78',
      heightCm: '166',
      ageYears: 39,
      activity: 'SEDENTARY',
      frequency: 3,
      goal: 'LOSE_WEIGHT',
    });
    const lowMan = calculateNutrition({
      sex: 'MALE',
      weightKg: '80',
      heightCm: '185',
      ageYears: 25,
      activity: 'MODERATE',
      frequency: 3,
      goal: 'LOSE_WEIGHT',
    });

    expect(moderateWoman.bmr.equals('1287.75')).toBe(true);
    expect(moderateWoman.activityMultiplier.equals('1.50')).toBe(true);
    expect(moderateWoman.tdee.equals('1931.625')).toBe(true);
    expect(moderateWoman.targetCalories.equals('1641.88125')).toBe(true);
    expect(moderateWoman.proteinGrams.equals('127.6')).toBe(true);
    expect(moderateWoman.fatGrams.equals('52.2')).toBe(true);
    expect(moderateWoman.carbsGrams.equals('165.4203125')).toBe(true);
    expect(
      moderateWoman.carbsGrams.equals(new Prisma.Decimal('58').mul('3')),
    ).toBe(false);

    expect(sedentaryWoman.bmr.equals('1461.5')).toBe(true);
    expect(sedentaryWoman.activityMultiplier.equals('1.35')).toBe(true);
    expect(sedentaryWoman.tdee.equals('1973.025')).toBe(true);
    expect(sedentaryWoman.targetCalories.equals('1677.07125')).toBe(true);
    expect(sedentaryWoman.proteinGrams.equals('146.743734375')).toBe(true);
    expect(sedentaryWoman.fatGrams.equals('70.2')).toBe(true);
    expect(sedentaryWoman.carbsGrams.equals('114.574078125')).toBe(true);

    expect(lowMan.bmr.equals('1836.25')).toBe(true);
    expect(lowMan.activityMultiplier.equals('1.40')).toBe(true);
    expect(lowMan.tdee.equals('2570.75')).toBe(true);
    expect(lowMan.targetCalories.equals('2185.1375')).toBe(true);
    expect(lowMan.proteinGrams.equals('176')).toBe(true);
    expect(lowMan.fatGrams.equals('72')).toBe(true);
    expect(lowMan.carbsGrams.equals('208.284375')).toBe(true);
  });

  it('marks negative carbs for review and does not invent the other limits', () => {
    const result = calculateNutrition({
      sex: 'FEMALE',
      weightKg: '40',
      heightCm: '100',
      ageYears: 90,
      activity: 'SEDENTARY',
      frequency: 2,
      goal: 'LOSE_WEIGHT',
    });

    expect(result.carbsGrams.equals('-30.6325')).toBe(true);
    expect(result.carbsNonPositive).toBe(true);
    expect(result.targetCalories.equals('457.47')).toBe(true);
    expect(result.status).toBe('REQUIRES_REVIEW');
    expect(result.reviewReasons).toEqual(['NEGATIVE_CARBS']);
    expect(NUTRITION_ALGORITHM.review).toEqual({
      minCalories: null,
      maxProteinCalorieShare: null,
      maxFatCalorieShare: null,
      maxWeightKg: null,
    });
  });

  it('marks a minor for review without changing the figures', () => {
    const adult = calculateNutrition(woman);
    const minor = calculateNutrition({ ...woman, ageYears: 17 });

    expect(minor.status).toBe('REQUIRES_REVIEW');
    expect(minor.reviewReasons).toEqual(['UNDERAGE']);
    expect(minor.targetCalories.equals(adult.targetCalories)).toBe(false);
    expect(minor.carbsGrams.gt(0)).toBe(true);
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
