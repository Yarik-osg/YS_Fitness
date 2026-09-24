import { describe, expect, it } from 'vitest';
import { CATALOG_PLANS } from './catalog-plans.js';

describe('CATALOG_PLANS', () => {
  it('seeds exactly three active plans with the mock amounts and intervals', () => {
    expect(CATALOG_PLANS).toHaveLength(3);
    expect(CATALOG_PLANS).toEqual([
      {
        code: '1_MONTH',
        name: '1 month',
        priceAmount: 99_000,
        intervalMonths: 1,
      },
      {
        code: '3_MONTHS',
        name: '3 months',
        priceAmount: 249_000,
        intervalMonths: 3,
      },
      {
        code: 'FULL_ACCESS',
        name: 'FULL ACCESS',
        priceAmount: 349_000,
        intervalMonths: 3,
      },
    ]);
  });
});
