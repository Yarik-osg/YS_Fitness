import {
  persistSelectedPlanId,
  readPlanIdFromQuery,
  readSelectedPlanId,
} from '@/lib/subscriptions/selected-plan';

export type OnboardingStatusUser = {
  profile?: { onboardingCompletedAt?: string | null } | null;
};

export function getPostAuthPath(
  user: OnboardingStatusUser,
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

export function getPostRegisterPath(
  selectedPlanId: string | null = readSelectedPlanId() ?? readPlanIdFromQuery(),
) {
  if (selectedPlanId) {
    persistSelectedPlanId(selectedPlanId);
    return `/checkout?planId=${encodeURIComponent(selectedPlanId)}`;
  }

  return '/checkout';
}

export function resolveIncompleteGuestDestination(
  pathname: string,
): string | null {
  return pathname.startsWith('/register') ? null : '/onboarding';
}
