import { describe, expect, it } from 'vitest';
import { inPeriod, periodStart, subtractCalendarMonths } from './weight-period';

describe('subtractCalendarMonths', () => {
  it('clamps May 31 to the last day of February', () => {
    expect(subtractCalendarMonths(new Date(2025, 4, 31, 15, 30, 0), 3)).toEqual(
      new Date(2025, 1, 28, 15, 30, 0),
    );
    expect(subtractCalendarMonths(new Date(2024, 4, 31, 15, 30, 0), 3)).toEqual(
      new Date(2024, 1, 29, 15, 30, 0),
    );
  });
});

describe('inPeriod', () => {
  const now = new Date(2025, 4, 31, 15, 30, 0);

  it('includes the three-month boundary and excludes the millisecond before it', () => {
    const start = periodStart(now, '3m')!;
    expect(inPeriod(start.toISOString(), now, '3m')).toBe(true);
    expect(
      inPeriod(new Date(start.getTime() - 1).toISOString(), now, '3m'),
    ).toBe(false);
  });

  it('uses an inclusive trailing 30 times 24 hours', () => {
    const start = periodStart(now, '30d')!;
    expect(start.getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(inPeriod(start.toISOString(), now, '30d')).toBe(true);
    expect(
      inPeriod(new Date(start.getTime() - 1).toISOString(), now, '30d'),
    ).toBe(false);
  });

  it('keeps every point for the full history', () => {
    expect(inPeriod('2020-01-01T00:00:00.000Z', now, 'all')).toBe(true);
  });
});
