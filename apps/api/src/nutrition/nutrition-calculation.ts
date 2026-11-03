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

export const NUTRITION_REVIEW_REASONS = [
  'NEGATIVE_CARBS',
  'LOW_CALORIES',
  'EXCESSIVE_PROTEIN_RATIO',
  'EXCESSIVE_FAT_RATIO',
  'UNUSUAL_BODY_WEIGHT',
  'UNDERAGE',
] as const;

export type NutritionActivity = (typeof NUTRITION_ACTIVITIES)[number];
export type NutritionGoal = (typeof NUTRITION_GOALS)[number];
export type NutritionFrequency = (typeof NUTRITION_FREQUENCIES)[number];
export type NutritionReviewReason = (typeof NUTRITION_REVIEW_REASONS)[number];
export type NutritionCalculationStatus = 'VALID' | 'REQUIRES_REVIEW';

/**
 * PAL rows keep the stored activity names.
 * SEDENTARY is the spec's sedentary row, MODERATE its low row,
 * HIGH its moderate row, VERY_HIGH its high row.
 * Carb guides are recorded and are not applied to the result.
 * Review limits stay unset until a number is agreed. Null skips that check.
 */
export const NUTRITION_ALGORITHM = {
  pal: {
    SEDENTARY: { 2: '1.30', 3: '1.35', 4: '1.40' },
    MODERATE: { 2: '1.35', 3: '1.40', 4: '1.45' },
    HIGH: { 2: '1.45', 3: '1.50', 4: '1.55' },
    VERY_HIGH: { 2: '1.55', 3: '1.60', 4: '1.65' },
  },
  goalMultiplier: {
    LOSE_WEIGHT: '0.85',
    MAINTAIN: '1',
    GAIN_MUSCLE: '1.10',
    RECOMPOSITION: '1',
  },
  protein: {
    LOSE_WEIGHT: { share: '0.35', minPerKg: '1.6', maxPerKg: '2.2' },
    MAINTAIN: { share: '0.30', minPerKg: '1.4', maxPerKg: '2.0' },
    GAIN_MUSCLE: { share: '0.25', minPerKg: '1.6', maxPerKg: '2.0' },
    RECOMPOSITION: { share: '0.30', minPerKg: '1.8', maxPerKg: '2.2' },
  },
  fatPerKg: {
    LOSE_WEIGHT: '0.9',
    MAINTAIN: '1.0',
    GAIN_MUSCLE: '1.1',
    RECOMPOSITION: '0.9',
  },
  carbGuidePerKg: {
    LOSE_WEIGHT: '3',
    MAINTAIN: '4',
    GAIN_MUSCLE: '5',
    RECOMPOSITION: '4',
  },
  review: {
    minCalories: null as string | null,
    maxProteinCalorieShare: null as string | null,
    maxFatCalorieShare: null as string | null,
    maxWeightKg: null as string | null,
  },
} as const;

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
  displayCalories: number;
  displayProteinGrams: number;
  displayFatGrams: number;
  displayCarbsGrams: number;
  status: NutritionCalculationStatus;
  reviewReasons: NutritionReviewReason[];
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
    NUTRITION_ALGORITHM.pal[input.activity][input.frequency],
  );
  const goalMultiplier = new Prisma.Decimal(
    NUTRITION_ALGORITHM.goalMultiplier[input.goal],
  );
  const goalAdjustment = goalMultiplier.minus(1);
  const bmr = weightKg
    .mul(10)
    .plus(heightCm.mul('6.25'))
    .minus(new Prisma.Decimal(input.ageYears).mul(5))
    .plus(input.sex === 'FEMALE' ? -161 : 5);
  const tdee = bmr.mul(activityMultiplier);
  const targetCalories = tdee.mul(goalMultiplier);
  const proteinRule = NUTRITION_ALGORITHM.protein[input.goal];
  const proteinInitial = targetCalories.mul(proteinRule.share).div(4);
  const proteinMin = weightKg.mul(proteinRule.minPerKg);
  const proteinMax = weightKg.mul(proteinRule.maxPerKg);
  const proteinGrams = Prisma.Decimal.min(
    Prisma.Decimal.max(proteinInitial, proteinMin),
    proteinMax,
  );
  const fatGrams = weightKg.mul(NUTRITION_ALGORITHM.fatPerKg[input.goal]);
  const carbsGrams = targetCalories
    .minus(proteinGrams.mul(4))
    .minus(fatGrams.mul(9))
    .div(4);
  const reviewReasons = reviewOf({
    ageYears: input.ageYears,
    weightKg,
    targetCalories,
    proteinGrams,
    fatGrams,
    carbsGrams,
  });

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
    displayCalories: roundNutritionDisplay(targetCalories),
    displayProteinGrams: roundNutritionDisplay(proteinGrams),
    displayFatGrams: roundNutritionDisplay(fatGrams),
    displayCarbsGrams: roundNutritionDisplay(carbsGrams),
    status: reviewReasons.length > 0 ? 'REQUIRES_REVIEW' : 'VALID',
    reviewReasons,
  };
}

/** Integer display. Matches the web half-away-from-zero rounding. */
export function roundNutritionDisplay(value: Prisma.Decimal): number {
  const negative = value.isNeg();
  const rounded = value
    .abs()
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
  return negative ? -rounded : rounded;
}

function reviewOf(input: {
  ageYears: number;
  weightKg: Prisma.Decimal;
  targetCalories: Prisma.Decimal;
  proteinGrams: Prisma.Decimal;
  fatGrams: Prisma.Decimal;
  carbsGrams: Prisma.Decimal;
}): NutritionReviewReason[] {
  const reasons: NutritionReviewReason[] = [];
  if (input.carbsGrams.lt(0)) reasons.push('NEGATIVE_CARBS');
  if (input.ageYears < 18) reasons.push('UNDERAGE');
  const limits = NUTRITION_ALGORITHM.review;
  if (
    limits.minCalories !== null &&
    input.targetCalories.lt(limits.minCalories)
  ) {
    reasons.push('LOW_CALORIES');
  }
  if (limits.maxProteinCalorieShare !== null && input.targetCalories.gt(0)) {
    const share = input.proteinGrams.mul(4).div(input.targetCalories);
    if (share.gt(limits.maxProteinCalorieShare)) {
      reasons.push('EXCESSIVE_PROTEIN_RATIO');
    }
  }
  if (limits.maxFatCalorieShare !== null && input.targetCalories.gt(0)) {
    const share = input.fatGrams.mul(9).div(input.targetCalories);
    if (share.gt(limits.maxFatCalorieShare)) {
      reasons.push('EXCESSIVE_FAT_RATIO');
    }
  }
  if (limits.maxWeightKg !== null && input.weightKg.gt(limits.maxWeightKg)) {
    reasons.push('UNUSUAL_BODY_WEIGHT');
  }
  return reasons;
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
