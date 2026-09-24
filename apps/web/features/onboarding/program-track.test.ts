import { describe, expect, it } from 'vitest';
import {
  biologicalSexFromProgramTrack,
  ONBOARDING_WIZARD_STEPS,
} from './program-track';

describe('biologicalSexFromProgramTrack', () => {
  it('maps female track to FEMALE and male track to MALE', () => {
    expect(biologicalSexFromProgramTrack('female')).toBe('FEMALE');
    expect(biologicalSexFromProgramTrack('male')).toBe('MALE');
  });
});

describe('ONBOARDING_WIZARD_STEPS', () => {
  it('includes the additive physique step', () => {
    expect(ONBOARDING_WIZARD_STEPS).toBe(14);
  });
});
