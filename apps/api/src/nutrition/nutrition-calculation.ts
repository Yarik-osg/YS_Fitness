import { Prisma } from '@prisma/client';

export const NUTRITION_ACTIVITIES = [
  'SEDENTARY',
  'MODERATE',
  'HIGH',
  'VERY_HIGH',
] as const;
export const NUTRITION_GOALS = [
  'LOSE_WEIGHT',
  'MAINTAIN',
  'GAIN_MUSCLE',
  'RECOMPOSITION',
] as const;
export const NUTRITION_FREQUENCIES = [2, 3, 4] as const;

export type NutritionActivity = (typeof NUTRITION_ACTIVITIES)[number];
export type NutritionGoal = (typeof NUTRITION_GOALS)[number];
export type NutritionFrequency = (typeof NUTRITION_FREQUENCIES)[number];

const ACTIVITY_MULTIPLIER: Record<
  NutritionActivity,
  Record<NutritionFrequency, string>
> = {
  SEDENTARY: { 2: '1.35', 3: '1.40', 4: '1.45' },
  MODERATE: { 2: '1.50', 3: '1.55', 4: '1.60' },
  HIGH: { 2: '1.65', 3: '1.70', 4: '1.75' },
  VERY_HIGH: { 2: '1.80', 3: '1.85', 4: '1.90' },
};

const GOAL_ADJUSTMENT: Record<NutritionGoal, string> = {
  LOSE_WEIGHT: '-0.15',
  MAINTAIN: '0',
  GAIN_MUSCLE: '0.075',
  RECOMPOSITION: '0',
};

const PROTEIN_PER_KG: Record<NutritionGoal, string> = {
  LOSE_WEIGHT: '2',
  MAINTAIN: '1.6',
  GAIN_MUSCLE: '1.8',
  RECOMPOSITION: '2',
};

const FAT_PER_KG = '0.9';

export class NutritionInputError extends Error {
  readonly code = 'NUTRITION_INPUT_UNSUPPORTED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'NutritionInputError';
  }
}

export interface NutritionCalculationInput {
  sex: 'FEMALE' | 'MALE';
  weightKg: Prisma.Decimal.Value;
  heightCm: Prisma.Decimal.Value;
  ageYears: number;
  activity: NutritionActivity;
  frequency: NutritionFrequency;
  goal: NutritionGoal;
}

export interface NutritionCalculation {
  bmr: Prisma.Decimal;
  activityMultiplier: Prisma.Decimal;
  tdee: Prisma.Decimal;
  goalAdjustment: Prisma.Decimal;
  targetCalories: Prisma.Decimal;
  proteinGrams: Prisma.Decimal;
  fatGrams: Prisma.Decimal;
  carbsGrams: Prisma.Decimal;
  carbsNonPositive: boolean;
}

export function calculateNutrition(
  input: NutritionCalculationInput,
): NutritionCalculation {
  const weightKg = positiveDecimal(input.weightKg, 'weightKg');
  const heightCm = positiveDecimal(input.heightCm, 'heightCm');
  if (!Number.isInteger(input.ageYears) || input.ageYears < 1) {
    throw new NutritionInputError(
      'ageYears must be a positive whole number of years',
    );
  }
  if (input.sex !== 'FEMALE' && input.sex !== 'MALE') {
    throw new NutritionInputError('sex is not supported');
  }
  if (!isActivity(input.activity) || !isFrequency(input.frequency)) {
    throw new NutritionInputError(
      'activity and workout frequency are not a supported pair',
    );
  }
  if (!isGoal(input.goal)) {
    throw new NutritionInputError('goal is not supported');
  }

  const activityMultiplier = new Prisma.Decimal(
    ACTIVITY_MULTIPLIER[input.activity][input.frequency],
  );
  const goalAdjustment = new Prisma.Decimal(GOAL_ADJUSTMENT[input.goal]);
  const bmr = weightKg
    .mul(10)
    .plus(heightCm.mul('6.25'))
    .minus(new Prisma.Decimal(input.ageYears).mul(5))
    .plus(input.sex === 'FEMALE' ? -161 : 5);
  const tdee = bmr.mul(activityMultiplier);
  const targetCalories = tdee.mul(new Prisma.Decimal(1).plus(goalAdjustment));
  const proteinGrams = weightKg.mul(PROTEIN_PER_KG[input.goal]);
  const fatGrams = weightKg.mul(FAT_PER_KG);
  const carbsGrams = targetCalories
    .minus(proteinGrams.mul(4))
    .minus(fatGrams.mul(9))
    .div(4);

  return {
    bmr,
    activityMultiplier,
    tdee,
    goalAdjustment,
    targetCalories,
    proteinGrams,
    fatGrams,
    carbsGrams,
    carbsNonPositive: carbsGrams.lte(0),
  };
}

function positiveDecimal(value: Prisma.Decimal.Value, field: string) {
  try {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(0) || !decimal.isFinite()) {
      throw new NutritionInputError(`${field} must be greater than 0`);
    }
    return decimal;
  } catch (error) {
    if (error instanceof NutritionInputError) throw error;
    throw new NutritionInputError(`${field} must be greater than 0`);
  }
}

function isActivity(value: string): value is NutritionActivity {
  return (NUTRITION_ACTIVITIES as readonly string[]).includes(value);
}

function isFrequency(value: number): value is NutritionFrequency {
  return (NUTRITION_FREQUENCIES as readonly number[]).includes(value);
}

function isGoal(value: string): value is NutritionGoal {
  return (NUTRITION_GOALS as readonly string[]).includes(value);
}
