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
});

describe('expectedProgramSessions', () => {
  it('is eight times the weekly frequency', () => {
    expect(expectedProgramSessions(2)).toBe(16);
    expect(expectedProgramSessions(3)).toBe(24);
    expect(expectedProgramSessions(4)).toBe(32);
  });
});
