import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  PaymentProvider,
  Prisma,
  SubscriptionStatus,
  type Plan,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { addCalendarMonths } from './period.js';
import type { SubscriptionWithPlan } from './subscriptions.repository.js';
import { SubscriptionsService } from './subscriptions.service.js';

const plan: Plan = {
  id: '11111111-1111-4111-8111-111111111111',
  code: '1_MONTH',
  name: '1 month',
  priceAmount: 99_000,
  currency: 'UAH',
  intervalMonths: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function subscription(
  overrides: Partial<SubscriptionWithPlan> = {},
): SubscriptionWithPlan {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    userId: '33333333-3333-4333-8333-333333333333',
    planId: plan.id,
    status: SubscriptionStatus.ACTIVE,
    provider: PaymentProvider.MOCK,
    providerReference: 'mock_sub',
    currentPeriodEnd: addCalendarMonths(new Date(), 1),
    grantedByUserId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    plan,
    ...overrides,
  };
}

function createService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
  paymentProvider = {
    createCheckout: vi.fn().mockResolvedValue({
      checkoutUrl: null,
      providerReference: 'mock_sub',
      immediateConfirmation: true,
    }),
  },
) {
  return new SubscriptionsService(
    repository as never,
    paymentProvider as never,
  );
}

describe('SubscriptionsService', () => {
  it('activates a mock checkout and sets period end about one month out', async () => {
    const created = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const activated = subscription();
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(created),
      activate: vi.fn().mockResolvedValue(activated),
    };
    const paymentProvider = {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: null,
        providerReference: `mock_${created.id}`,
        immediateConfirmation: true,
      }),
    };

    const service = createService(repository, paymentProvider);
    const before = Date.now();
    const result = await service.checkout(created.userId, { planId: plan.id });
    const after = Date.now();

    expect(paymentProvider.createCheckout).toHaveBeenCalled();
    expect(repository.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: created.id,
        providerReference: `mock_${created.id}`,
      }),
    );
    const periodEnd = new Date(
      repository.activate.mock.calls[0]?.[0].currentPeriodEnd as Date,
    ).getTime();
    const min = addCalendarMonths(new Date(before), 1).getTime();
    const max = addCalendarMonths(new Date(after), 1).getTime();
    expect(periodEnd).toBeGreaterThanOrEqual(min);
    expect(periodEnd).toBeLessThanOrEqual(max);
    expect(result.subscription.status).toBe('ACTIVE');
    expect(result.checkoutUrl).toBeNull();
  });

  it('sets a three-month period end for the quarterly plan', async () => {
    const quarterly = { ...plan, intervalMonths: 3, code: '3_MONTHS' };
    const created = subscription({
      status: SubscriptionStatus.PENDING,
      plan: quarterly,
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(quarterly),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(created),
      activate: vi.fn().mockResolvedValue(subscription({ plan: quarterly })),
    };

    const service = createService(repository);
    const before = Date.now();
    await service.checkout(created.userId, { planId: quarterly.id });
    const after = Date.now();
    const periodEnd = new Date(
      repository.activate.mock.calls[0]?.[0].currentPeriodEnd as Date,
    ).getTime();

    expect(periodEnd).toBeGreaterThanOrEqual(
      addCalendarMonths(new Date(before), 3).getTime(),
    );
    expect(periodEnd).toBeLessThanOrEqual(
      addCalendarMonths(new Date(after), 3).getTime(),
    );
  });

  it('rejects a sequential second checkout while a non-terminal sub exists', async () => {
    const service = createService({
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(subscription()),
      createPending: vi.fn(),
    });

    await expect(
      service.checkout('user-1', { planId: plan.id }),
    ).rejects.toBeInstanceOf(ConflictException);

    try {
      await service.checkout('user-1', { planId: plan.id });
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_ALREADY_ACTIVE',
      });
    }
  });

  it('maps a unique-index race to the same already-active conflict', async () => {
    const service = createService({
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.16.2',
        }),
      ),
    });

    try {
      await service.checkout('user-1', { planId: plan.id });
      throw new Error('expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_ALREADY_ACTIVE',
      });
    }
  });

  it('maps a raw postgres 23505 to the same already-active conflict', async () => {
    const service = createService({
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockRejectedValue({ code: '23505' }),
    });

    await expect(
      service.checkout('user-1', { planId: plan.id }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_ALREADY_ACTIVE' },
    });
  });

  it('rejects granting while a non-terminal subscription exists', async () => {
    const service = createService({
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findUserId: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(subscription()),
      createManualGrant: vi.fn(),
    });

    await expect(
      service.grant('trainer-1', { userId: 'user-1', planId: plan.id }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_ALREADY_ACTIVE' },
    });
  });

  it('stores grantedByUserId on a trainer grant', async () => {
    const granted = subscription({
      provider: PaymentProvider.MANUAL,
      grantedByUserId: 'trainer-1',
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findUserId: vi.fn().mockResolvedValue({ id: granted.userId }),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createManualGrant: vi.fn().mockResolvedValue(granted),
    };
    const service = createService(repository);

    const result = await service.grant('trainer-1', {
      userId: granted.userId,
      planId: plan.id,
    });

    expect(repository.createManualGrant).toHaveBeenCalledWith(
      expect.objectContaining({ grantedByUserId: 'trainer-1' }),
    );
    expect(result.grantedByUserId).toBe('trainer-1');
    expect(result.provider).toBe('MANUAL');
  });

  it('rejects checkout for an unknown plan', async () => {
    const service = createService({
      findActivePlanById: vi.fn().mockResolvedValue(null),
    });

    await expect(
      service.checkout('user-1', { planId: plan.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
