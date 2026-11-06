import type {
  ActiveNutritionTarget,
  FoodLogEntryResponse,
  FoodMacroTotal,
} from '@repo/shared-types';
import {
  FOOD_MAX_GRAMS,
  FOOD_MIN_GRAMS,
  PER_100G_MAX_KCAL,
  PER_100G_MAX_MACRO,
} from '@repo/validation';

export const FOOD_MACRO_KEYS = ['kcal', 'protein', 'fat', 'carbs'] as const;

/** True when `value` has at most one decimal, within float noise. */
export function oneDecimal(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const tenths = Math.round(value * 10);
  return Math.abs(value * 10 - tenths) < 1e-6;
}

export function gramsAccepted(value: number): boolean {
  return (
    oneDecimal(value) && value >= FOOD_MIN_GRAMS && value <= FOOD_MAX_GRAMS
  );
}
export type FoodMacroKey = (typeof FOOD_MACRO_KEYS)[number];

/** Half up, matching the API's one-decimal food snapshots. */
export function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const power = 10 ** decimals;
  const shifted = Math.abs(value) * power;
  const rounded = Math.floor(shifted + 0.5);
  return (sign * rounded) / power;
}

export function scalePer100g(per100g: number, grams: number): number {
  return roundHalfUp((per100g * grams) / 100, 1);
}

export function scaleAmount(
  amount: number,
  fromGrams: number,
  toGrams: number,
): number {
  if (fromGrams === 0) return amount;
  return roundHalfUp((amount * toGrams) / fromGrams, 1);
}

export function previewMacros(
  per100g: {
    kcalPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
  },
  grams: number,
): FoodMacroTotal {
  return {
    kcal: scalePer100g(per100g.kcalPer100g, grams),
    protein: scalePer100g(per100g.proteinPer100g, grams),
    fat: scalePer100g(per100g.fatPer100g, grams),
    carbs: scalePer100g(per100g.carbsPer100g, grams),
  };
}

export function entryCap(grams: number, key: FoodMacroKey): number {
  const per100g = key === 'kcal' ? PER_100G_MAX_KCAL : PER_100G_MAX_MACRO;
  return (per100g * grams) / 100;
}

export function exceedsEntryCap(
  grams: number,
  values: FoodMacroTotal,
): boolean {
  return FOOD_MACRO_KEYS.some((key) => values[key] > entryCap(grams, key));
}

export function targetAsTotals(target: ActiveNutritionTarget): FoodMacroTotal {
  return {
    kcal: target.targetCalories,
    protein: target.proteinGrams,
    fat: target.fatGrams,
    carbs: target.carbsGrams,
  };
}

/** Display-only sum of one meal. The day total still comes from the server. */
export function mealSubtotal(entries: FoodLogEntryResponse[]): FoodMacroTotal {
  return entries.reduce<FoodMacroTotal>(
    (sum, entry) => ({
      kcal: sum.kcal + entry.kcal,
      protein: sum.protein + entry.protein,
      fat: sum.fat + entry.fat,
      carbs: sum.carbs + entry.carbs,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export function remainingTone(value: number): {
  tone: 'left' | 'over';
  amount: number;
} {
  if (value < 0) return { tone: 'over', amount: Math.abs(value) };
  return { tone: 'left', amount: value };
}
