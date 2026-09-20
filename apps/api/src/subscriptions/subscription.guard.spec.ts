import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionGuard } from './subscription.guard.js';
import type { SubscriptionsService } from './subscriptions.service.js';

function contextFor(userId?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId
          ? { sub: userId, sessionId: 'session-1', role: UserRole.CLIENT }
          : undefined,
      }),
    }),
  };
}

describe('SubscriptionGuard', () => {
  it('allows an ACTIVE subscription whose period has not ended', async () => {
    const subscriptions = {
      hasActiveAccess: vi.fn().mockResolvedValue(true),
    };
    const guard = new SubscriptionGuard(
      subscriptions as unknown as SubscriptionsService,
    );

    await expect(
      guard.canActivate(contextFor('user-1') as never),
    ).resolves.toBe(true);
  });

  it('denies expired, canceled, or missing subscriptions', async () => {
    const subscriptions = {
      hasActiveAccess: vi.fn().mockResolvedValue(false),
    };
    const guard = new SubscriptionGuard(
      subscriptions as unknown as SubscriptionsService,
    );

    await expect(
      guard.canActivate(contextFor('user-1') as never),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_REQUIRED' },
    });
    expect(ForbiddenException).toBeTypeOf('function');
  });

  it('denies requests without an authenticated user', async () => {
    const subscriptions = {
      hasActiveAccess: vi.fn(),
    };
    const guard = new SubscriptionGuard(
      subscriptions as unknown as SubscriptionsService,
    );

    await expect(
      guard.canActivate(contextFor() as never),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_REQUIRED' },
    });
    expect(subscriptions.hasActiveAccess).not.toHaveBeenCalled();
  });
});
