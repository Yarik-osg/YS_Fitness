import { getMe } from '@/lib/api/users';
import { getMySubscription } from '@/lib/api/subscriptions';
import { refresh } from '@/lib/api/auth';
import { persistSelectedPlanId } from './selected-plan';
import { resolvePlanCtaPath } from './plan-cta';

export async function resolvePlanDestination(planId: string): Promise<string> {
  persistSelectedPlanId(planId);

  try {
    await refresh();
    const [user, subscription] = await Promise.all([
      getMe(),
      getMySubscription(),
    ]);

    return resolvePlanCtaPath({
      authenticated: true,
      onboarded: Boolean(user.profile?.onboardingCompletedAt),
      hasNonTerminalSubscription: Boolean(subscription),
      planId,
    });
  } catch {
    return resolvePlanCtaPath({
      authenticated: false,
      onboarded: false,
      hasNonTerminalSubscription: false,
      planId,
    });
  }
}
