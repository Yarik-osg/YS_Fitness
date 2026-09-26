import { onboardingSchema, type OnboardingInput } from '@repo/validation';
import {
  activityLevelFromFrequency,
  physiqueLevelFromCurrentBody,
  weightGoalFromMainGoal,
} from './derived-profile';
import type { OnboardingDraft } from './onboarding-store';
import { biologicalSexFromProgramTrack } from './program-track';

const PROFILE_STEP = 11;

const STEP_BY_FIELD: Record<string, number> = {
  programTrack: 0,
  biologicalSexForCalculation: 0,
  currentBody: 1,
  physiqueLevel: 1,
  desiredBody: 2,
  mainGoal: 3,
  goal: 3,
  experience: 4,
  trainingFrequency: 5,
  activityLevel: 6,
  focusAreas: 7,
  nutritionCurrent: 8,
  mealsPerDay: 9,
  eatingHabits: 10,
  dateOfBirth: PROFILE_STEP,
  heightCm: PROFILE_STEP,
  weightKg: PROFILE_STEP,
  timezone: PROFILE_STEP,
};

export type DraftValidation =
  { ok: true; payload: OnboardingInput } | { ok: false; step: number };

function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function payloadCandidate(draft: OnboardingDraft, timezone: string) {
  return {
    dateOfBirth: draft.dateOfBirth,
    biologicalSexForCalculation:
      draft.biologicalSexForCalculation ??
      (draft.programTrack
        ? biologicalSexFromProgramTrack(draft.programTrack)
        : undefined),
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    activityLevel:
      draft.activityLevel ??
      activityLevelFromFrequency(draft.trainingFrequency),
    goal: draft.goal ?? weightGoalFromMainGoal(draft.mainGoal),
    timezone,
    programTrack: draft.programTrack,
    currentBody: draft.currentBody,
    desiredBody: draft.desiredBody,
    physiqueLevel:
      draft.physiqueLevel ?? physiqueLevelFromCurrentBody(draft.currentBody),
    mainGoal: draft.mainGoal,
    experience: draft.experience,
    trainingFrequency: draft.trainingFrequency,
    focusAreas: draft.focusAreas,
    nutritionCurrent: draft.nutritionCurrent,
    mealsPerDay: draft.mealsPerDay,
    eatingHabits: draft.eatingHabits,
  };
}

export function validateOnboardingDraft(
  draft: OnboardingDraft,
  timezone = defaultTimezone(),
): DraftValidation {
  const result = onboardingSchema.safeParse(payloadCandidate(draft, timezone));
  if (result.success) return { ok: true, payload: result.data };

  const steps = result.error.issues.map((issue) => {
    const field = issue.path[0];
    return typeof field === 'string'
      ? (STEP_BY_FIELD[field] ?? PROFILE_STEP)
      : PROFILE_STEP;
  });
  return { ok: false, step: Math.min(...steps) };
}

export function tryBuildOnboardingPayload(
  draft: OnboardingDraft,
  timezone = defaultTimezone(),
): OnboardingInput | null {
  const result = validateOnboardingDraft(draft, timezone);
  return result.ok ? result.payload : null;
}

export function buildOnboardingPayload(
  draft: OnboardingDraft,
  timezone = defaultTimezone(),
): OnboardingInput {
  return onboardingSchema.parse(payloadCandidate(draft, timezone));
}
