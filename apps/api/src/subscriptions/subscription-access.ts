import { SubscriptionStatus, type Prisma } from '@prisma/client';

/** Same rule as `grantsActiveAccess`: ACTIVE and the period has not ended. */
export function activeAccessWhere(now: Date): Prisma.SubscriptionWhereInput {
  return {
    status: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: { gt: now },
  };
}

export function grantsActiveAccess(
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
  } | null,
  now: Date,
): boolean {
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return false;
  }
  if (!subscription.currentPeriodEnd) {
    return false;
  }
  return subscription.currentPeriodEnd > now;
}
