import { describe, expect, it } from 'vitest';
import { formatGoalPercent, roundHalfAwayFromZero } from './nutrition-display';

describe('nutrition display', () => {
  it('rounds stored calories and grams half away from zero', () => {
    expect(roundHalfAwayFromZero('1739.429375')).toBe('1739');
    expect(roundHalfAwayFromZero('193.5')).toBe('194');
    expect(roundHalfAwayFromZero('-42.5')).toBe('-43');
  });

  it('shows the four goal factors as percents', () => {
    expect(formatGoalPercent('-0.15')).toBe('−15%');
    expect(formatGoalPercent('0')).toBe('0%');
    expect(formatGoalPercent('0.075')).toBe('+7.5%');
  });
});
