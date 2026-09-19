import type { MeResponse } from '@repo/shared-types';

export function getPostAuthPath(user: MeResponse) {
  return user.profile?.onboardingCompletedAt ? '/dashboard' : '/onboarding';
}
