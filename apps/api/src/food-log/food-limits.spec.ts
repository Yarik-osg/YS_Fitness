import { Prisma } from '@prisma/client';
import {
  ENTRY_MAX_KCAL,
  ENTRY_MAX_MACRO,
  FOOD_MAX_GRAMS,
  FOOD_MIN_GRAMS,
  PER_100G_MAX_KCAL,
  PER_100G_MAX_MACRO,
} from '@repo/validation';
import { describe, expect, it } from 'vitest';
import { roundHalfUp } from '../common/round-half-up.js';
import { entryFitsGrams } from './food-snapshot.js';

describe('food value limits', () => {
  it('keeps the worst case inside the decimal columns', () => {
    const worstEntryKcal = (PER_100G_MAX_KCAL * FOOD_MAX_GRAMS) / 100;
    const worstEntryMacro = (PER_100G_MAX_MACRO * FOOD_MAX_GRAMS) / 100;
    expect(worstEntryKcal).toBe(ENTRY_MAX_KCAL);
    expect(worstEntryMacro).toBe(ENTRY_MAX_MACRO);
    expect(new Prisma.Decimal(worstEntryKcal).lte('99999.9')).toBe(true);
    expect(new Prisma.Decimal(worstEntryMacro).lte('99999.9')).toBe(true);
    expect(new Prisma.Decimal(PER_100G_MAX_KCAL).lte('99999.99')).toBe(true);
    expect(new Prisma.Decimal(PER_100G_MAX_MACRO).lte('99999.99')).toBe(true);
  });

  it('does not let half-up rounding cross the cap at any 1-decimal gram amount', () => {
    // grams = n/10. The kcal cap is then PER_100G_MAX_KCAL * n / 1000, so it
    // has at most one decimal for every n when the per-100g kcal cap is a
    // multiple of 100. The macro cap needs a multiple of 10.
    expect(PER_100G_MAX_KCAL % 100).toBe(0);
    expect(PER_100G_MAX_MACRO % 10).toBe(0);

    for (const grams of [FOOD_MIN_GRAMS, 0.3, 1, 1.1, FOOD_MAX_GRAMS]) {
      const kcalCap = new Prisma.Decimal(PER_100G_MAX_KCAL).mul(grams).div(100);
      const macroCap = new Prisma.Decimal(PER_100G_MAX_MACRO)
        .mul(grams)
        .div(100);
      expect(roundHalfUp(kcalCap, 1).equals(kcalCap)).toBe(true);
      expect(roundHalfUp(macroCap, 1).equals(macroCap)).toBe(true);
      expect(
        entryFitsGrams({
          grams,
          kcal: kcalCap.toNumber(),
          protein: macroCap.toNumber(),
          fat: macroCap.toNumber(),
          carbs: macroCap.toNumber(),
        }),
      ).toBe(true);
    }
  });
});
