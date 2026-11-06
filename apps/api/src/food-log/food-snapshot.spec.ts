import { describe, expect, it } from 'vitest';
import {
  applyFoodLogPatch,
  per100gFromSnapshot,
  snapshotFromPer100g,
} from './food-snapshot.js';

const entry = { grams: 100, kcal: 200, protein: 10, fat: 5, carbs: 20 };

describe('food snapshot', () => {
  it('multiplies per-100g values by the logged grams', () => {
    expect(
      snapshotFromPer100g(
        {
          kcalPer100g: 46,
          proteinPer100g: 3.4,
          fatPer100g: 1,
          carbsPer100g: 4.8,
        },
        150,
      ),
    ).toEqual({ kcal: 69, protein: 5.1, fat: 1.5, carbs: 7.2 });
  });

  it('rescales every macro when only the grams change', () => {
    expect(applyFoodLogPatch(entry, { grams: 50 })).toEqual({
      grams: 50,
      kcal: 100,
      protein: 5,
      fat: 2.5,
      carbs: 10,
    });
  });

  it('keeps a typed macro and rescales only the ones left out', () => {
    expect(applyFoodLogPatch(entry, { grams: 50, kcal: 80 })).toEqual({
      grams: 50,
      kcal: 80,
      protein: 5,
      fat: 2.5,
      carbs: 10,
    });
    expect(applyFoodLogPatch(entry, { kcal: 80 })).toEqual({
      ...entry,
      kcal: 80,
    });
  });

  it('derives per-100g values from the edited snapshot', () => {
    expect(per100gFromSnapshot(80, 50).toNumber()).toBe(160);
    expect(per100gFromSnapshot(1, 3).toNumber()).toBe(33.33);
  });
});
