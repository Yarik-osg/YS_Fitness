import { splitLocalePath } from './proxy-auth';
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

export function safeInternalPath(
  next: string | null | undefined,
): string | null {
  if (!next) return null;
  let path: string;
  try {
    path = decodeURIComponent(next);
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(path)) return null;
  return path;
}

export function loginPathWithNext(pathname: string, search = ''): string {
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}

export function resolvePostLoginPath(
  user: OnboardingStatusUser,
  next: string | null,
): string {
  if (!user.profile?.onboardingCompletedAt) {
    return getPostAuthPath(user);
  }
  const safe = safeInternalPath(next);
  if (!safe) return getPostAuthPath(user);
  const queryIndex = safe.indexOf('?');
  const path = queryIndex === -1 ? safe : safe.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : safe.slice(queryIndex);
  const { pathnameWithoutLocale } = splitLocalePath(path);
  return `${pathnameWithoutLocale}${query}`;
}
