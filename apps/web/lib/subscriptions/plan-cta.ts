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
    return `/register?planId=${encoded}`;
  }

  if (!onboarded) {
    return '/onboarding';
  }

  if (hasNonTerminalSubscription) {
    return '/dashboard';
  }

  return `/checkout?planId=${encoded}`;
}
