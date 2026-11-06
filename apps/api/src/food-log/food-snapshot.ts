import { Prisma } from '@prisma/client';

export interface FoodSnapshot {
  grams: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

export function snapshotFromPer100g(
  per100g: {
    kcalPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
  },
  grams: number,
): Omit<FoodSnapshot, 'grams'> {
  return {
    kcal: scalePer100g(per100g.kcalPer100g, grams),
    protein: scalePer100g(per100g.proteinPer100g, grams),
    fat: scalePer100g(per100g.fatPer100g, grams),
    carbs: scalePer100g(per100g.carbsPer100g, grams),
  };
}

export function applyFoodLogPatch(
  entry: FoodSnapshot,
  patch: Partial<FoodSnapshot>,
): FoodSnapshot {
  const grams = patch.grams ?? entry.grams;
  const gramsChanged = patch.grams !== undefined && patch.grams !== entry.grams;
  const scaled = (current: number) =>
    gramsChanged ? scaleAmount(current, entry.grams, grams) : current;
  return {
    grams,
    kcal: patch.kcal ?? scaled(entry.kcal),
    protein: patch.protein ?? scaled(entry.protein),
    fat: patch.fat ?? scaled(entry.fat),
    carbs: patch.carbs ?? scaled(entry.carbs),
  };
}

export function per100gFromSnapshot(
  amount: number,
  grams: number,
): Prisma.Decimal {
  return new Prisma.Decimal(amount)
    .div(grams)
    .mul(100)
    .toDecimalPlaces(2, HALF_UP);
}

export function entryDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(1, HALF_UP);
}

function scalePer100g(per100g: number, grams: number): number {
  return new Prisma.Decimal(per100g)
    .mul(grams)
    .div(100)
    .toDecimalPlaces(1, HALF_UP)
    .toNumber();
}

function scaleAmount(
  amount: number,
  fromGrams: number,
  toGrams: number,
): number {
  return new Prisma.Decimal(amount)
    .mul(toGrams)
    .div(fromGrams)
    .toDecimalPlaces(1, HALF_UP)
    .toNumber();
}

export function calendarDateToUtc(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
