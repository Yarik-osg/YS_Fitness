import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayRange,
  groupByLocalDay,
  isSameMonth,
  localDateKey,
  monthGrid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekDays,
} from './calendar';

// All dates are built from local parts, so the tests hold in any timezone.
const keys = (days: Date[]) => days.map(localDateKey);

describe('startOfWeek', () => {
  it('moves any weekday back to Monday', () => {
    expect(localDateKey(startOfWeek(new Date(2026, 9, 7, 15)))).toBe(
      '2026-10-05',
    );
    expect(localDateKey(startOfWeek(new Date(2026, 9, 5)))).toBe('2026-10-05');
  });

  it('treats Sunday as the last day of the week', () => {
    expect(localDateKey(startOfWeek(new Date(2026, 9, 11, 23, 59)))).toBe(
      '2026-10-05',
    );
  });

  it('crosses a month and a year', () => {
    expect(localDateKey(startOfWeek(new Date(2026, 0, 1)))).toBe('2025-12-29');
  });
});

describe('weekDays', () => {
  it('lists Monday through Sunday', () => {
    expect(keys(weekDays(new Date(2026, 9, 11)))).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });
});

describe('addDays', () => {
  it('adds whole calendar days across a month and a year', () => {
    expect(localDateKey(addDays(new Date(2026, 9, 30), 3))).toBe('2026-11-02');
    expect(localDateKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(localDateKey(addDays(new Date(2026, 9, 5), -5))).toBe('2026-09-30');
  });

  it('keeps the calendar day across a DST change', () => {
    expect(localDateKey(addDays(new Date(2026, 9, 24), 2))).toBe('2026-10-26');
    expect(localDateKey(addDays(new Date(2026, 2, 28), 2))).toBe('2026-03-30');
  });
});

describe('addMonths and startOfMonth', () => {
  it('lands on the first of the target month', () => {
    expect(localDateKey(addMonths(new Date(2026, 0, 31), 1))).toBe(
      '2026-02-01',
    );
    expect(localDateKey(addMonths(new Date(2026, 9, 11), -10))).toBe(
      '2025-12-01',
    );
    expect(localDateKey(startOfMonth(new Date(2026, 9, 11, 18)))).toBe(
      '2026-10-01',
    );
  });

  it('compares months', () => {
    expect(isSameMonth(new Date(2026, 9, 1), new Date(2026, 9, 31))).toBe(true);
    expect(isSameMonth(new Date(2026, 9, 31), new Date(2026, 10, 1))).toBe(
      false,
    );
    expect(isSameMonth(new Date(2025, 9, 1), new Date(2026, 9, 1))).toBe(false);
  });
});

describe('monthGrid', () => {
  it('shows whole Monday-first weeks around the month', () => {
    const grid = keys(monthGrid(new Date(2026, 9, 11)));

    expect(grid).toHaveLength(35);
    expect(grid[0]).toBe('2026-09-28');
    expect(grid[3]).toBe('2026-10-01');
    expect(grid.at(-1)).toBe('2026-11-01');
  });

  it('needs six rows for a month that starts on Sunday', () => {
    const grid = keys(monthGrid(new Date(2026, 2, 1)));

    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-02-23');
    expect(grid[6]).toBe('2026-03-01');
    expect(grid.at(-1)).toBe('2026-04-05');
  });

  it('fits a month that is exactly four weeks', () => {
    const grid = keys(monthGrid(new Date(2027, 1, 10)));

    expect(grid).toHaveLength(28);
    expect(grid[0]).toBe('2027-02-01');
    expect(grid.at(-1)).toBe('2027-02-28');
  });

  it('includes 29 February in a leap year', () => {
    const grid = keys(monthGrid(new Date(2028, 1, 1)));

    expect(grid).toContain('2028-02-29');
    expect(grid).not.toContain('2028-02-30');
    expect(grid).toHaveLength(35);
  });

  it('has no gaps or repeats', () => {
    for (let month = 0; month < 12; month += 1) {
      const grid = monthGrid(new Date(2026, month, 1));
      expect(grid.length % 7).toBe(0);
      expect(grid.length).toBeLessThanOrEqual(42);
      expect(grid[0]!.getDay()).toBe(1);
      grid.forEach((day, index) => {
        if (index > 0) {
          expect(localDateKey(day)).toBe(
            localDateKey(addDays(grid[index - 1]!, 1)),
          );
        }
      });
    }
  });
});

describe('localDateKey', () => {
  it('uses the local date right up to and after midnight', () => {
    expect(localDateKey(new Date(2026, 9, 11, 23, 59, 59))).toBe('2026-10-11');
    expect(localDateKey(new Date(2026, 9, 12, 0, 0, 0))).toBe('2026-10-12');
  });

  it('pads single digits', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('dayRange', () => {
  it('runs from local midnight to the next local midnight', () => {
    const range = dayRange(new Date(2026, 9, 5, 14), new Date(2026, 9, 11, 9));

    expect(new Date(range.from).getTime()).toBe(new Date(2026, 9, 5).getTime());
    expect(new Date(range.to).getTime()).toBe(new Date(2026, 9, 12).getTime());
  });

  it('keeps a full month grid inside the API range cap', () => {
    for (let month = 0; month < 24; month += 1) {
      const grid = monthGrid(new Date(2026, month, 1));
      const range = dayRange(grid[0]!, grid.at(-1)!);
      const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;

      expect(days).toBeGreaterThan(27);
      expect(days).toBeLessThanOrEqual(43);
    }
  });

  it('startOfDay drops the time', () => {
    expect(startOfDay(new Date(2026, 9, 5, 23, 59)).getTime()).toBe(
      new Date(2026, 9, 5).getTime(),
    );
  });
});

describe('groupByLocalDay', () => {
  it('groups logs by the local day they finished', () => {
    const morning = {
      id: 'a',
      completedAt: new Date(2026, 9, 5, 8).toISOString(),
    };
    const evening = {
      id: 'b',
      completedAt: new Date(2026, 9, 5, 23, 30).toISOString(),
    };
    const next = {
      id: 'c',
      completedAt: new Date(2026, 9, 6, 0, 10).toISOString(),
    };

    const groups = groupByLocalDay([morning, evening, next]);

    expect([...groups.keys()]).toEqual(['2026-10-05', '2026-10-06']);
    expect(groups.get('2026-10-05')).toEqual([morning, evening]);
    expect(groups.get('2026-10-06')).toEqual([next]);
  });

  it('returns an empty map for no logs', () => {
    expect(groupByLocalDay([]).size).toBe(0);
  });
});
