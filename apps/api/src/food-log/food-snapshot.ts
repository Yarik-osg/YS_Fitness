import { Prisma } from '@prisma/client';
import { PER_100G_MAX_KCAL, PER_100G_MAX_MACRO } from '@repo/validation';
import { roundHalfUp } from '../common/round-half-up.js';

export interface FoodSnapshot {
  grams: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

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

// 1000 kcal and 100 g of each macro per 100 g, with grams at 1 decimal,
// land on a 1-decimal entry cap. Half-up rounding of a value already
// within that cap cannot cross it.
export function entryFitsGrams(snapshot: FoodSnapshot): boolean {
  const grams = new Prisma.Decimal(snapshot.grams);
  const kcalCap = new Prisma.Decimal(PER_100G_MAX_KCAL).mul(grams).div(100);
  const macroCap = new Prisma.Decimal(PER_100G_MAX_MACRO).mul(grams).div(100);
  return (
    roundHalfUp(snapshot.kcal, 1).lte(kcalCap) &&
    roundHalfUp(snapshot.protein, 1).lte(macroCap) &&
    roundHalfUp(snapshot.fat, 1).lte(macroCap) &&
    roundHalfUp(snapshot.carbs, 1).lte(macroCap)
  );
}

export function per100gFromSnapshot(
  amount: number,
  grams: number,
): Prisma.Decimal {
  return roundHalfUp(new Prisma.Decimal(amount).div(grams).mul(100), 2);
}

export function entryDecimal(value: number): Prisma.Decimal {
  return roundHalfUp(value, 1);
}

function scalePer100g(per100g: number, grams: number): number {
  return roundHalfUp(
    new Prisma.Decimal(per100g).mul(grams).div(100),
    1,
  ).toNumber();
}

function scaleAmount(
  amount: number,
  fromGrams: number,
  toGrams: number,
): number {
  return roundHalfUp(
    new Prisma.Decimal(amount).mul(toGrams).div(fromGrams),
    1,
  ).toNumber();
}

export function calendarDateToUtc(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
