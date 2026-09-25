export function resolvePlanCtaPath({
  authenticated,
  onboarded,
  hasNonTerminalSubscription,
  planId,
}: {
  authenticated: boolean;
  onboarded: boolean;
  hasNonTerminalSubscription: boolean;
  planId: string;
}): string {
  const encoded = encodeURIComponent(planId);

  if (!authenticated) {
    return '/onboarding';
  }

  if (!onboarded) {
    return '/onboarding';
  }

  if (hasNonTerminalSubscription) {
    return '/dashboard';
  }

  return `/checkout?planId=${encoded}`;
}

export function resolvePostQuizAccessHref({
  authenticated,
  planId,
}: {
  authenticated: boolean;
  planId: string | null;
}): {
  pathname: '/register' | '/checkout' | '/dashboard';
  query?: { planId: string };
} {
  if (!authenticated) {
    return planId
      ? { pathname: '/register', query: { planId } }
      : { pathname: '/register' };
  }

  return planId
    ? { pathname: '/checkout', query: { planId } }
    : { pathname: '/dashboard' };
}
