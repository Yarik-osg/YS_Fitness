import { describe, expect, it } from 'vitest';
import {
  formatHryvniaAmount,
  kopiykasToHryvnia,
  monthlyHryvnia,
  savingsHryvnia,
} from './money';

describe('subscription money helpers', () => {
  it('converts kopiykas and derives monthly rate and savings', () => {
    expect(kopiykasToHryvnia(249_000)).toBe(2490);
    expect(formatHryvniaAmount(830)).toBe('830');
    expect(monthlyHryvnia({ priceAmount: 249_000, intervalMonths: 3 })).toBe(
      830,
    );
    expect(
      savingsHryvnia(
        { priceAmount: 249_000, intervalMonths: 3 },
        { priceAmount: 99_000 },
      ),
    ).toBe(480);
  });
});
