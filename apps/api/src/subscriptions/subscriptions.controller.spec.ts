import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubscriptionGuard } from './subscription.guard.js';
import { SubscriptionsController } from './subscriptions.controller.js';

const GUARDS_METADATA = '__guards__';

describe('SubscriptionsController.renew', () => {
  it('uses the same JWT guard as checkout and not SubscriptionGuard', () => {
    const checkoutGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      SubscriptionsController.prototype.checkout,
    );
    const renewGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      SubscriptionsController.prototype.renew,
    );

    expect(renewGuards).toEqual(checkoutGuards);
    expect(renewGuards).toEqual([JwtAuthGuard]);
    expect(renewGuards).not.toContain(SubscriptionGuard);
  });
});

describe('SubscriptionsController.mockWebhook', () => {
  it('is public so a payment provider can complete checkout', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        SubscriptionsController.prototype.completeMockPayment,
      ),
    ).toBeUndefined();
  });
});
