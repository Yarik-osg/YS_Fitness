import type { BiologicalSexForCalculation } from '@repo/shared-types';

export type ProgramTrack = 'female' | 'male';

export const ONBOARDING_WIZARD_STEPS = 13;

export function biologicalSexFromProgramTrack(
  track: ProgramTrack,
): BiologicalSexForCalculation {
  return track === 'male' ? 'MALE' : 'FEMALE';
}
