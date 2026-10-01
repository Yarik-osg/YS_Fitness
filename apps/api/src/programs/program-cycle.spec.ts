import { describe, expect, it } from 'vitest';
import { expectedProgramSessions, nextProgramDay } from './program-cycle.js';

describe('nextProgramDay', () => {
  it('starts at day 1 when nothing has been logged', () => {
    expect(nextProgramDay(null, 2)).toBe(1);
    expect(nextProgramDay(null, 3)).toBe(1);
    expect(nextProgramDay(null, 4)).toBe(1);
  });

  it('advances to the next day mid-cycle', () => {
    expect(nextProgramDay(1, 3)).toBe(2);
    expect(nextProgramDay(2, 4)).toBe(3);
  });

  it('wraps the last day back to day 1', () => {
    expect(nextProgramDay(2, 2)).toBe(1);
    expect(nextProgramDay(3, 3)).toBe(1);
    expect(nextProgramDay(4, 4)).toBe(1);
  });
});

describe('expectedProgramSessions', () => {
  it('is eight times the weekly frequency', () => {
    expect(expectedProgramSessions(2)).toBe(16);
    expect(expectedProgramSessions(3)).toBe(24);
    expect(expectedProgramSessions(4)).toBe(32);
  });
});
