import { describe, expect, it } from 'vitest';
import {
  expectedProgramSessions,
  isDayOpenInCycle,
  nextProgramDay,
} from './program-cycle.js';

describe('nextProgramDay', () => {
  it('starts at day 1 when nothing has been logged', () => {
    expect(nextProgramDay([], 2)).toBe(1);
    expect(nextProgramDay([], 3)).toBe(1);
    expect(nextProgramDay([], 4)).toBe(1);
  });

  it('advances to the first day that has not been completed', () => {
    expect(nextProgramDay([{ dayNumber: 1, count: 1 }], 3)).toBe(2);
    expect(
      nextProgramDay(
        [
          { dayNumber: 1, count: 1 },
          { dayNumber: 2, count: 1 },
        ],
        4,
      ),
    ).toBe(3);
  });

  it('stays on an earlier gap when a later day was logged', () => {
    expect(
      nextProgramDay(
        [
          { dayNumber: 1, count: 1 },
          { dayNumber: 3, count: 1 },
        ],
        3,
      ),
    ).toBe(2);
    expect(nextProgramDay([{ dayNumber: 3, count: 1 }], 3)).toBe(1);
  });

  it('follows the first unfinished day through a four-day cycle', () => {
    const frequency = 4;

    expect(nextProgramDay([], frequency)).toBe(1);

    const afterThird = [{ dayNumber: 3, count: 1 }];
    expect(nextProgramDay(afterThird, frequency)).toBe(1);

    const afterFirst = [
      { dayNumber: 1, count: 1 },
      { dayNumber: 3, count: 1 },
    ];
    expect(nextProgramDay(afterFirst, frequency)).toBe(2);

    const afterFourth = [
      { dayNumber: 1, count: 1 },
      { dayNumber: 3, count: 1 },
      { dayNumber: 4, count: 1 },
    ];
    expect(nextProgramDay(afterFourth, frequency)).toBe(2);

    expect(
      nextProgramDay(
        [
          { dayNumber: 1, count: 1 },
          { dayNumber: 2, count: 1 },
          { dayNumber: 3, count: 1 },
          { dayNumber: 4, count: 1 },
        ],
        frequency,
      ),
    ).toBe(1);
  });

  it('does not skip an earlier day when a later day was logged more than once', () => {
    expect(
      nextProgramDay(
        [
          { dayNumber: 3, count: 3 },
          { dayNumber: 4, count: 2 },
        ],
        4,
      ),
    ).toBe(1);
  });

  it('recommends the least-logged day when counts differ', () => {
    expect(
      nextProgramDay(
        [
          { dayNumber: 1, count: 2 },
          { dayNumber: 2, count: 0 },
          { dayNumber: 3, count: 1 },
          { dayNumber: 4, count: 0 },
        ],
        4,
      ),
    ).toBe(2);
  });

  it('stays on the only day of a one-day program', () => {
    expect(nextProgramDay([], 1)).toBe(1);
    expect(nextProgramDay([{ dayNumber: 1, count: 4 }], 1)).toBe(1);
  });

  it('starts the next cycle at day 1 when every day has been completed equally', () => {
    expect(
      nextProgramDay(
        [
          { dayNumber: 1, count: 1 },
          { dayNumber: 2, count: 1 },
        ],
        2,
      ),
    ).toBe(1);
    expect(
      nextProgramDay(
        [
          { dayNumber: 1, count: 2 },
          { dayNumber: 2, count: 2 },
          { dayNumber: 3, count: 2 },
        ],
        3,
      ),
    ).toBe(1);
  });
});

describe('isDayOpenInCycle', () => {
  it('closes a day that is ahead until the rest of the cycle catches up', () => {
    const counts = [{ dayNumber: 3, count: 1 }];

    expect(isDayOpenInCycle(3, counts, 4)).toBe(false);
    expect(isDayOpenInCycle(1, counts, 4)).toBe(true);
    expect(isDayOpenInCycle(2, counts, 4)).toBe(true);
    expect(isDayOpenInCycle(4, counts, 4)).toBe(true);
  });

  it('opens every day again once they have been logged the same number of times', () => {
    const counts = [
      { dayNumber: 1, count: 1 },
      { dayNumber: 2, count: 1 },
      { dayNumber: 3, count: 1 },
      { dayNumber: 4, count: 1 },
    ];

    expect(isDayOpenInCycle(3, counts, 4)).toBe(true);
    expect(isDayOpenInCycle(1, counts, 4)).toBe(true);
  });

  it('keeps an earlier unfinished day open when later days are ahead', () => {
    const counts = [
      { dayNumber: 1, count: 2 },
      { dayNumber: 3, count: 1 },
      { dayNumber: 4, count: 2 },
    ];

    expect(isDayOpenInCycle(2, counts, 4)).toBe(true);
    expect(isDayOpenInCycle(1, counts, 4)).toBe(false);
    expect(isDayOpenInCycle(3, counts, 4)).toBe(false);
  });

  it('treats a missing day number as outside the program', () => {
    expect(isDayOpenInCycle(0, [], 4)).toBe(false);
    expect(isDayOpenInCycle(-1, [], 4)).toBe(false);
    expect(isDayOpenInCycle(5, [], 4)).toBe(false);
    expect(isDayOpenInCycle(4, [], 4)).toBe(true);
    expect(isDayOpenInCycle(1, [], 1)).toBe(true);
    expect(isDayOpenInCycle(1, [{ dayNumber: 1, count: 2 }], 1)).toBe(true);
  });
});

describe('expectedProgramSessions', () => {
  it('is eight times the weekly frequency', () => {
    expect(expectedProgramSessions(2)).toBe(16);
    expect(expectedProgramSessions(3)).toBe(24);
    expect(expectedProgramSessions(4)).toBe(32);
  });
});
