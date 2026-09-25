import { describe, expect, it } from 'vitest';
import { bodyVariantIndex, previewProgramId } from './preview-program';

describe('previewProgramId', () => {
  it('picks the mock catalog offer from main goal and track', () => {
    expect(
      previewProgramId({
        mainGoal: 'lose_weight',
        focusAreas: [],
        eatingHabits: [],
      }),
    ).toBe('slim_tone');
    expect(
      previewProgramId({
        programTrack: 'male',
        mainGoal: 'get_stronger',
        focusAreas: [],
        eatingHabits: [],
      }),
    ).toBe('mass_power');
    expect(
      previewProgramId({
        mainGoal: 'maintain',
        focusAreas: [],
        eatingHabits: [],
      }),
    ).toBe('maintain');
  });
});

describe('bodyVariantIndex', () => {
  it('converts named and numeric body answers to 1-based labels', () => {
    expect(bodyVariantIndex('toned')).toBe(2);
    expect(bodyVariantIndex('3')).toBe(4);
  });
});
