import { onboardingSchema, type OnboardingInput } from '@repo/validation';
import type { OnboardingDraft } from './onboarding-store';

export function buildOnboardingPayload(
  draft: OnboardingDraft,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
): OnboardingInput {
  return onboardingSchema.parse({
    dateOfBirth: draft.dateOfBirth,
    biologicalSexForCalculation: draft.biologicalSexForCalculation,
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    activityLevel: draft.activityLevel,
    goal: draft.goal,
    timezone,
  });
}
