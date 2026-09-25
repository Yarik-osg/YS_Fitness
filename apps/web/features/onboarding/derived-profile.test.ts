import { describe, expect, it } from 'vitest';
import {
  activityLevelFromFrequency,
  physiqueLevelFromCurrentBody,
  weightGoalFromMainGoal,
} from './derived-profile';

describe('derived onboarding profile fields', () => {
  it('maps main goal to the profile weight goal', () => {
    expect(weightGoalFromMainGoal('lose_weight')).toBe('LOSE_WEIGHT');
    expect(weightGoalFromMainGoal('maintain')).toBe('MAINTAIN_WEIGHT');
    expect(weightGoalFromMainGoal('improve_body')).toBe('MAINTAIN_WEIGHT');
    expect(weightGoalFromMainGoal('build_muscle')).toBe('GAIN_WEIGHT');
    expect(weightGoalFromMainGoal('get_stronger')).toBe('GAIN_WEIGHT');
  });

  it('maps training frequency to activity level', () => {
    expect(activityLevelFromFrequency('2')).toBe('LIGHTLY_ACTIVE');
    expect(activityLevelFromFrequency('3')).toBe('MODERATELY_ACTIVE');
    expect(activityLevelFromFrequency('4')).toBe('VERY_ACTIVE');
  });

  it('maps current body onto the 0-9 physique scale', () => {
    expect(physiqueLevelFromCurrentBody('0')).toBe('0');
    expect(physiqueLevelFromCurrentBody('9')).toBe('9');
    expect(physiqueLevelFromCurrentBody('slim')).toBeUndefined();
  });
});
