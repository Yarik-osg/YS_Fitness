import { describe, expect, it } from 'vitest';
import { isRecommendedDay } from '@/lib/training-schedule';

// Local-time constructors keep these tests independent of the machine's
// timezone. The week of Mon 5 to Sun 11 October 2026 is used throughout.
const WEEK = Array.from(
  { length: 7 },
  (_, index) => new Date(2026, 9, 5 + index),
);
const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG_AGO = new Date(2026, 0, 1, 9).toISOString();

function recommended(frequencyPerWeek: number, assignedAt = LONG_AGO) {
  return WEEK.filter((day) =>
    isRecommendedDay(day, { frequencyPerWeek, assignedAt }),
  ).map((day) => NAMES[WEEK.indexOf(day)]);
}

describe('isRecommendedDay', () => {
  it('recommends Tuesday and Thursday for two days a week', () => {
    expect(recommended(2)).toEqual(['Tue', 'Thu']);
  });

  it('recommends Monday, Wednesday and Friday for three days a week', () => {
    expect(recommended(3)).toEqual(['Mon', 'Wed', 'Fri']);
  });

  it('recommends Monday, Tuesday, Thursday and Friday for four days a week', () => {
    expect(recommended(4)).toEqual(['Mon', 'Tue', 'Thu', 'Fri']);
  });

  it('recommends nothing without a schedule or for an unknown frequency', () => {
    expect(isRecommendedDay(WEEK[0]!, undefined)).toBe(false);
    expect(recommended(1)).toEqual([]);
    expect(recommended(5)).toEqual([]);
    expect(recommended(0)).toEqual([]);
  });

  it('never recommends the weekend', () => {
    for (const frequencyPerWeek of [2, 3, 4]) {
      expect(recommended(frequencyPerWeek)).not.toContain('Sat');
      expect(recommended(frequencyPerWeek)).not.toContain('Sun');
    }
  });

  it('starts on the local day the program was assigned', () => {
    // Assigned late on Wednesday evening: that Wednesday still counts, the
    // Monday before it does not.
    const assignedAt = new Date(2026, 9, 7, 23, 30).toISOString();
    expect(recommended(3, assignedAt)).toEqual(['Wed', 'Fri']);
    // Assigned on Thursday: Tuesday is before the program, Thursday is not.
    expect(recommended(2, new Date(2026, 9, 8, 0, 5).toISOString())).toEqual([
      'Thu',
    ]);
  });

  it('ignores an unparsable assignment date', () => {
    expect(recommended(3, 'not a date')).toEqual([]);
  });

  it('ignores the time of day of the checked date', () => {
    const lateTuesday = new Date(2026, 9, 6, 23, 59);
    expect(
      isRecommendedDay(lateTuesday, {
        frequencyPerWeek: 2,
        assignedAt: LONG_AGO,
      }),
    ).toBe(true);
  });
});
