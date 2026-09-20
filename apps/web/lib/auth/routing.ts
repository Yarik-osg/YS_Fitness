import type { MeResponse } from '@repo/shared-types';
import {
  persistSelectedPlanId,
  readPlanIdFromQuery,
  readSelectedPlanId,
} from '@/lib/subscriptions/selected-plan';

export function getPostAuthPath(
  user: MeResponse,
  selectedPlanId: string | null = readSelectedPlanId() ?? readPlanIdFromQuery(),
) {
  if (selectedPlanId) {
    persistSelectedPlanId(selectedPlanId);
  }

  if (!user.profile?.onboardingCompletedAt) {
    return '/onboarding';
  }

  if (selectedPlanId) {
    return `/checkout?planId=${encodeURIComponent(selectedPlanId)}`;
  }

  return '/dashboard';
}
