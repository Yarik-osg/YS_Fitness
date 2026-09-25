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
  repository: Record<string, unknown>,
  paymentProvider = {
    createCheckout: vi.fn().mockResolvedValue({
      checkoutUrl: null,
      providerReference: 'mock_sub',
      immediateConfirmation: true,
    }),
  },
) {
  return new SubscriptionsService(
    {
      transaction: vi.fn((work: (client: unknown) => unknown) =>
        work(transactionClient),
      ),
      expireLapsed: vi.fn().mockResolvedValue(0),
      ...repository,
    } as never,
    paymentProvider as never,
  );
}

const transactionClient = { kind: 'transaction-client' };

function inMemoryRepository(initial: SubscriptionWithPlan) {
  let row: SubscriptionWithPlan | null = initial;
  const nonTerminal = () =>
    row &&
    (row.status === SubscriptionStatus.PENDING ||
      row.status === SubscriptionStatus.ACTIVE)
      ? row
      : null;

  return {
    findActivePlanById: vi.fn().mockResolvedValue(plan),
    findUserId: vi.fn().mockResolvedValue({ id: initial.userId }),
    expireLapsed: vi.fn(async (_userId: string, now: Date) => {
      if (
        row?.status === SubscriptionStatus.ACTIVE &&
        row.currentPeriodEnd &&
        row.currentPeriodEnd <= now
      ) {
        row = { ...row, status: SubscriptionStatus.EXPIRED };
        return 1;
      }
      return 0;
    }),
    findNonTerminalByUserId: vi.fn(async () => nonTerminal()),
    createPending: vi.fn(async () => {
      if (nonTerminal()) throw { code: '23505' };
      row = subscription({
        status: SubscriptionStatus.PENDING,
        currentPeriodEnd: null,
      });
      return row;
    }),
    createManualGrant: vi.fn(async (input: { currentPeriodEnd: Date }) => {
      if (nonTerminal()) throw { code: '23505' };
      row = subscription({
        provider: PaymentProvider.MANUAL,
        currentPeriodEnd: input.currentPeriodEnd,
      });
      return row;
    }),
    activate: vi.fn(async (input: { currentPeriodEnd: Date }) => {
      row = subscription({ currentPeriodEnd: input.currentPeriodEnd });
      return row;
    }),
    current: () => row,
  };
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
      transactionClient,
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
      transactionClient,
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

describe('SubscriptionsService lazy expiry', () => {
  const lapsed = () =>
    subscription({ currentPeriodEnd: new Date(Date.now() - 60_000) });

  it('expires a lapsed ACTIVE row so checkout succeeds', async () => {
    const repository = inMemoryRepository(lapsed());
    const service = createService(repository);

    const result = await service.checkout(lapsed().userId, {
      planId: plan.id,
    });

    expect(repository.expireLapsed).toHaveBeenCalledWith(
      lapsed().userId,
      expect.any(Date),
      transactionClient,
    );
    expect(result.subscription.status).toBe('ACTIVE');
  });

  it('expires a lapsed ACTIVE row so a grant succeeds', async () => {
    const repository = inMemoryRepository(lapsed());
    const service = createService(repository);

    const result = await service.grant('trainer-1', {
      userId: lapsed().userId,
      planId: plan.id,
    });

    expect(result.status).toBe('ACTIVE');
    expect(result.provider).toBe('MANUAL');
  });

  it('returns null from getMine and denies access once lapsed', async () => {
    const repository = inMemoryRepository(lapsed());
    const service = createService(repository);

    await expect(service.getMine(lapsed().userId)).resolves.toBeNull();
    await expect(service.hasActiveAccess(lapsed().userId)).resolves.toBe(false);
    expect(repository.current()?.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it('keeps blocking checkout and grant while the period has not ended', async () => {
    const repository = inMemoryRepository(subscription());
    const service = createService(repository);

    await expect(
      service.checkout('user-1', { planId: plan.id }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_ALREADY_ACTIVE' },
    });
    await expect(
      service.grant('trainer-1', { userId: 'user-1', planId: plan.id }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_ALREADY_ACTIVE' },
    });
    await expect(service.hasActiveAccess('user-1')).resolves.toBe(true);
    expect(repository.current()?.status).toBe(SubscriptionStatus.ACTIVE);
  });
});

describe('SubscriptionsService checkout transaction', () => {
  it('runs every checkout write on the transaction client', async () => {
    const created = subscription({ status: SubscriptionStatus.PENDING });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(created),
      activate: vi.fn().mockResolvedValue(subscription()),
    };

    await createService(repository).checkout('user-1', { planId: plan.id });

    expect(repository.findNonTerminalByUserId).toHaveBeenCalledWith(
      'user-1',
      transactionClient,
    );
    expect(repository.createPending).toHaveBeenCalledWith(
      expect.anything(),
      transactionClient,
    );
    expect(repository.activate).toHaveBeenCalledWith(
      expect.anything(),
      transactionClient,
    );
  });

  it('propagates a provider failure out of the transaction', async () => {
    const providerError = new Error('provider unavailable');
    const transaction = vi.fn((work: (client: unknown) => unknown) =>
      work(transactionClient),
    );
    const repository = {
      transaction,
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi
        .fn()
        .mockResolvedValue(
          subscription({ status: SubscriptionStatus.PENDING }),
        ),
      activate: vi.fn(),
    };
    const service = createService(repository, {
      createCheckout: vi.fn().mockRejectedValue(providerError),
    });

    await expect(service.checkout('user-1', { planId: plan.id })).rejects.toBe(
      providerError,
    );
    await expect(transaction.mock.results[0]?.value).rejects.toBe(
      providerError,
    );
    expect(repository.activate).not.toHaveBeenCalled();
  });
});
