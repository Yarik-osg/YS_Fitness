/** Same rule as the API `grantsActiveAccess`: ACTIVE and the period has not ended. */
export function grantsActiveAccess(
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
  } | null,
  now = new Date(),
): boolean {
  if (
    !subscription ||
    subscription.status !== 'ACTIVE' ||
    !subscription.currentPeriodEnd
  ) {
    return false;
  }
  return Date.parse(subscription.currentPeriodEnd) > now.getTime();
}
