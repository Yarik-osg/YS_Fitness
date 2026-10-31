import { describe, expect, it } from 'vitest';
import { NutritionInputError } from './nutrition-calculation.js';
import { ageInTimeZone } from './nutrition-age.js';

const birthday = new Date('1996-11-02T00:00:00.000Z');

describe('ageInTimeZone', () => {
  it('waits for the birthday in the profile timezone', () => {
    expect(
      ageInTimeZone(
        birthday,
        'Europe/Kyiv',
        new Date('2026-11-01T21:30:00.000Z'),
      ),
    ).toBe(29);
    expect(
      ageInTimeZone(
        birthday,
        'Europe/Kyiv',
        new Date('2026-11-01T22:30:00.000Z'),
      ),
    ).toBe(30);
  });

  it('rejects a timezone Intl does not know', () => {
    expect(() =>
      ageInTimeZone(
        birthday,
        'Not/AZone',
        new Date('2026-11-02T00:00:00.000Z'),
      ),
    ).toThrow(NutritionInputError);
  });
});
