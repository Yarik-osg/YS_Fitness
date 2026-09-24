import { onboardingSchema, type OnboardingInput } from '@repo/validation';
import {
  activityLevelFromFrequency,
  physiqueLevelFromCurrentBody,
  weightGoalFromMainGoal,
} from './derived-profile';
import type { OnboardingDraft } from './onboarding-store';
import { biologicalSexFromProgramTrack } from './program-track';

export function tryBuildOnboardingPayload(
  draft: OnboardingDraft,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
): OnboardingInput | null {
  try {
    return buildOnboardingPayload(draft, timezone);
  } catch {
    return null;
  }
}

export function buildOnboardingPayload(
  draft: OnboardingDraft,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
): OnboardingInput {
  return onboardingSchema.parse({
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
  });
}
