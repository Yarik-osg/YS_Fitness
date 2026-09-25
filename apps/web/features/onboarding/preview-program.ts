import type { OnboardingDraft } from './onboarding-store';

export type PreviewProgramId =
  | 'slim_tone'
  | 'power_build'
  | 'maintain'
  | 'lean_build'
  | 'mass_power'
  | 'maintain_pro';

export function previewProgramId(draft: OnboardingDraft): PreviewProgramId {
  const male = draft.programTrack === 'male';
  const goal = draft.mainGoal;

  if (goal === 'lose_weight' || goal === 'improve_body') {
    return male ? 'lean_build' : 'slim_tone';
  }
  if (goal === 'build_muscle' || goal === 'get_stronger') {
    return male ? 'mass_power' : 'power_build';
  }
  return male ? 'maintain_pro' : 'maintain';
}
