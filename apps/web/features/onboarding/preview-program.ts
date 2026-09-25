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

export function previewFocusKey(value: string) {
  return `choices.focus.${value}`;
}

export function bodyVariantIndex(value?: string) {
  if (!value) return 1;
  const named = ['slim', 'toned', 'athletic', 'defined', 'full'];
  const namedIndex = named.indexOf(value);
  if (namedIndex >= 0) return namedIndex + 1;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric + 1 : 1;
}
