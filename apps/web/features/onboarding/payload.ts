import { onboardingSchema, type OnboardingInput } from '@repo/validation';
import type { OnboardingDraft } from './onboarding-store';
import { biologicalSexFromProgramTrack } from './program-track';

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
    activityLevel: draft.activityLevel,
    goal: draft.goal,
    timezone,
    programTrack: draft.programTrack,
    currentBody: draft.currentBody,
    desiredBody: draft.desiredBody,
    physiqueLevel: draft.physiqueLevel,
    mainGoal: draft.mainGoal,
    experience: draft.experience,
    trainingFrequency: draft.trainingFrequency,
    focusAreas: draft.focusAreas,
    nutritionCurrent: draft.nutritionCurrent,
    mealsPerDay: draft.mealsPerDay,
    eatingHabits: draft.eatingHabits,
  });
}
