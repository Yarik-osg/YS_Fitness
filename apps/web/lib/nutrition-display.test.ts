import { describe, expect, it } from 'vitest';
import {
  formatGoalPercent,
  roundHalfAwayFromZero,
  shownNutrition,
} from './nutrition-display';

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

  it('keeps the trainer numbers in front of a newer calculation', () => {
    const calculation = {
      targetCalories: '2061',
      proteinGrams: '110',
      fatGrams: '50',
      carbsGrams: '294',
    };
    const manual = {
      ...calculation,
      targetCalories: '1800',
      source: 'MANUAL' as const,
    };
    expect(shownNutrition(calculation, manual)?.targetCalories).toBe('1800');
    expect(
      shownNutrition(calculation, { ...manual, source: 'CALCULATED' })
        ?.targetCalories,
    ).toBe('2061');
  });
});
