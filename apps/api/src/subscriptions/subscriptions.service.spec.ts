import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  PaymentProvider,
  Prisma,
  SubscriptionStatus,
  type Plan,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { addCalendarMonths } from './period.js';
import {
  mockWebhookExpiresAt,
  signMockWebhook,
} from './providers/mock-webhook-signature.js';
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
    pendingPlanId: null,
    checkoutUrl: null,
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
  config: { get: (key: string) => unknown } = {
    get: (key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'CSRF_SECRET') return CSRF_SECRET;
      if (key === 'WEB_ORIGINS') return 'http://localhost:3000';
      return undefined;
    },
  },
) {
  return new SubscriptionsService(
    {
      transaction: vi.fn((work: (client: unknown) => unknown) =>
        work(transactionClient),
      ),
      expireLapsed: vi.fn().mockResolvedValue(0),
      reserveCheckoutSlot: vi.fn(
        async (input: { id: string; pendingPlanId: string }) =>
          subscription({ id: input.id, pendingPlanId: input.pendingPlanId }),
      ),
      attachCheckoutProvider: vi.fn(
        async (input: {
          id: string;
          pendingPlanId: string;
          providerReference: string;
          checkoutUrl: string | null;
        }) =>
          subscription({
            id: input.id,
            pendingPlanId: input.pendingPlanId,
            providerReference: input.providerReference,
            checkoutUrl: input.checkoutUrl,
          }),
      ),
      setCheckoutUrl: vi.fn(
        async (input: { id: string; checkoutUrl: string }) =>
          subscription({ id: input.id, checkoutUrl: input.checkoutUrl }),
      ),
      ...repository,
    } as never,
    paymentProvider as never,
    config as never,
  );
}

const transactionClient = { kind: 'transaction-client' };
const CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';

function signedWebhook(providerReference: string, now = Date.now()) {
  const expiresAt = mockWebhookExpiresAt(now);
  return {
    providerReference,
    expiresAt,
    signature: signMockWebhook(CSRF_SECRET, providerReference, expiresAt),
  };
}

function expectSignedReturnUrl(
  checkoutUrl: string | null,
  providerReference: string,
) {
  expect(checkoutUrl).toBeTruthy();
  const url = new URL(checkoutUrl!);
  expect(url.origin + url.pathname).toBe(
    'http://localhost:3000/checkout/return',
  );
  expect(url.searchParams.get('providerReference')).toBe(providerReference);
  const expiresAt = Number(url.searchParams.get('expiresAt'));
  expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  expect(url.searchParams.get('signature')).toBe(
    signMockWebhook(CSRF_SECRET, providerReference, expiresAt),
  );
}

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
    reserveCheckoutSlot: vi.fn(async (input: { pendingPlanId: string }) => {
      if (!row) return null;
      row = { ...row, pendingPlanId: input.pendingPlanId };
      return row;
    }),
    attachCheckoutProvider: vi.fn(
      async (input: {
        pendingPlanId: string;
        providerReference: string;
        checkoutUrl: string | null;
      }) => {
        if (!row || row.pendingPlanId !== input.pendingPlanId) return null;
        row = {
          ...row,
          providerReference: input.providerReference,
          checkoutUrl: input.checkoutUrl,
        };
        return row;
      },
    ),
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

    await expect(service.getMine(lapsed().userId)).resolves.toEqual({
      subscription: null,
      checkoutUrl: null,
    });
    await expect(service.hasActiveAccess(lapsed().userId)).resolves.toBe(false);
    expect(repository.current()?.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it('returns a resume checkout url for an in-flight payment', async () => {
    const stored = 'https://pay.example/first?session=hosted';
    const current = subscription({
      pendingPlanId: plan.id,
      providerReference: 'pay_first',
      checkoutUrl: stored,
    });
    const setCheckoutUrl = vi.fn();
    const service = createService({
      findNonTerminalByUserId: vi.fn().mockResolvedValue(current),
      setCheckoutUrl,
    });

    const first = await service.getMine(current.userId);
    const second = await service.getMine(current.userId);

    expect(first.subscription?.id).toBe(current.id);
    expect(first.checkoutUrl).toBe(stored);
    expect(second.checkoutUrl).toBe(stored);
    expect(setCheckoutUrl).not.toHaveBeenCalled();
  });

  it('does not mint a completion url on getMine when none was stored', async () => {
    const current = subscription({
      pendingPlanId: plan.id,
      providerReference: 'pay_first',
      checkoutUrl: null,
    });
    const setCheckoutUrl = vi.fn();
    const service = createService({
      findNonTerminalByUserId: vi.fn().mockResolvedValue(current),
      setCheckoutUrl,
    });

    const result = await service.getMine(current.userId);

    expect(result.checkoutUrl).toBeNull();
    expect(setCheckoutUrl).not.toHaveBeenCalled();
  });

  it('does not refresh an expired return url on getMine', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 1;
    const stored = `http://localhost:3000/checkout/return?providerReference=pay_first&expiresAt=${expiresAt}&signature=${signMockWebhook(
      CSRF_SECRET,
      'pay_first',
      expiresAt,
    )}`;
    const current = subscription({
      pendingPlanId: plan.id,
      providerReference: 'pay_first',
      checkoutUrl: stored,
    });
    const setCheckoutUrl = vi.fn();
    const service = createService({
      findNonTerminalByUserId: vi.fn().mockResolvedValue(current),
      setCheckoutUrl,
    });

    const result = await service.getMine(current.userId);

    expect(result.checkoutUrl).toBe(stored);
    expect(setCheckoutUrl).not.toHaveBeenCalled();
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
    expect(repository.activate).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalled();
  });

  it('stores a provider reference on delayed first checkout', async () => {
    const created = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(created),
      reserveCheckoutSlot: vi.fn().mockResolvedValue({
        ...created,
        pendingPlanId: plan.id,
      }),
      attachCheckoutProvider: vi.fn().mockResolvedValue({
        ...created,
        pendingPlanId: plan.id,
        providerReference: 'pay_first',
      }),
      activate: vi.fn(),
    };
    const service = createService(repository, {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/first',
        providerReference: 'pay_first',
        immediateConfirmation: false,
      }),
    });

    const result = await service.checkout(created.userId, { planId: plan.id });

    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.reserveCheckoutSlot).toHaveBeenCalledWith(
      { id: created.id, pendingPlanId: plan.id },
      transactionClient,
    );
    expect(repository.attachCheckoutProvider).toHaveBeenCalledWith(
      {
        id: created.id,
        pendingPlanId: plan.id,
        providerReference: 'pay_first',
        checkoutUrl: 'https://pay.example/first',
      },
      transactionClient,
    );
    expect(result.checkoutUrl).toBe('https://pay.example/first');
    expect(result.subscription.providerReference).toBe('pay_first');
  });

  it('points delayed checkout without a hosted URL at the signed return page', async () => {
    const created = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const reserved = { ...created, pendingPlanId: plan.id };
    const attached = {
      ...reserved,
      providerReference: 'pay_first',
    };
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(created),
      reserveCheckoutSlot: vi.fn().mockResolvedValue(reserved),
      attachCheckoutProvider: vi.fn().mockResolvedValue(attached),
      activate: vi.fn(),
    };
    const service = createService(repository, {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: null,
        providerReference: 'pay_first',
        immediateConfirmation: false,
      }),
    });

    const result = await service.checkout(created.userId, { planId: plan.id });

    expectSignedReturnUrl(result.checkoutUrl, 'pay_first');
  });

  it('does not create a provider session when the pending slot is already taken', async () => {
    const created = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const createCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: 'https://pay.example/first',
      providerReference: 'pay_first',
      immediateConfirmation: false,
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(created),
      reserveCheckoutSlot: vi.fn().mockResolvedValue(null),
      activate: vi.fn(),
    };
    const service = createService(repository, { createCheckout });

    await expect(
      service.checkout(created.userId, { planId: plan.id }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_CHECKOUT_PENDING' },
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });
});

describe('SubscriptionsService.renew', () => {
  it('starts a checkout when the current subscription is expired', async () => {
    const created = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const activated = subscription();
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      expireLapsed: vi.fn().mockResolvedValue(1),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(created),
      activate: vi.fn().mockResolvedValue(activated),
      extendActive: vi.fn(),
    };

    const service = createService(repository);
    const result = await service.renew(created.userId, { planId: plan.id });

    expect(repository.createPending).toHaveBeenCalledWith(
      { userId: created.userId, planId: plan.id },
      transactionClient,
    );
    expect(repository.activate).toHaveBeenCalled();
    expect(repository.extendActive).not.toHaveBeenCalled();
    expect(result.subscription.status).toBe('ACTIVE');
    expect(result.checkoutUrl).toBeNull();
  });

  it('extends an active period without creating a second subscription', async () => {
    const periodEnd = new Date('2026-12-01T00:00:00.000Z');
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      code: '3_MONTHS',
      intervalMonths: 3,
    };
    const current = subscription({
      currentPeriodEnd: periodEnd,
      plan,
    });
    const extended = subscription({
      planId: quarterly.id,
      plan: quarterly,
      currentPeriodEnd: addCalendarMonths(periodEnd, 3),
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(quarterly),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(current),
      createPending: vi.fn(),
      extendActive: vi.fn().mockResolvedValue(extended),
    };

    const paymentProvider = {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: null,
        providerReference: 'mock_sub',
        immediateConfirmation: true,
      }),
    };
    const service = createService(repository, paymentProvider);
    const result = await service.renew(current.userId, {
      planId: quarterly.id,
    });

    expect(paymentProvider.createCheckout).toHaveBeenCalledWith({
      subscriptionId: current.id,
      planIntervalMonths: 3,
    });
    expect(repository.createPending).not.toHaveBeenCalled();
    expect(repository.extendActive).toHaveBeenCalledWith(
      {
        id: current.id,
        planId: quarterly.id,
        currentPeriodEnd: addCalendarMonths(periodEnd, 3),
        providerReference: 'mock_sub',
        pendingPlanId: null,
      },
      transactionClient,
    );
    expect(result.subscription.id).toBe(current.id);
    expect(result.subscription.planId).toBe(quarterly.id);
    expect(result.subscription.currentPeriodEnd).toBe(
      addCalendarMonths(periodEnd, 3).toISOString(),
    );
  });

  it('completes a pending checkout instead of rejecting', async () => {
    const pending = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const activated = subscription();
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(pending),
      createPending: vi.fn(),
      setPlan: vi.fn(),
      activate: vi.fn().mockResolvedValue(activated),
      extendActive: vi.fn(),
    };

    const service = createService(repository);
    const result = await service.renew(pending.userId, { planId: plan.id });

    expect(repository.createPending).not.toHaveBeenCalled();
    expect(repository.setPlan).not.toHaveBeenCalled();
    expect(repository.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pending.id,
        providerReference: 'mock_sub',
      }),
      transactionClient,
    );
    expect(repository.extendActive).not.toHaveBeenCalled();
    expect(result.subscription.status).toBe('ACTIVE');
  });

  it('records a delayed active renewal instead of stacking immediately', async () => {
    const periodEnd = new Date('2026-12-01T00:00:00.000Z');
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      code: '3_MONTHS',
      intervalMonths: 3,
    };
    const current = subscription({ currentPeriodEnd: periodEnd, plan });
    const reserved = { ...current, pendingPlanId: quarterly.id };
    const attached = {
      ...reserved,
      providerReference: 'pay_renew',
    };
    const createCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: 'https://pay.example/renew',
      providerReference: 'pay_renew',
      immediateConfirmation: false,
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(quarterly),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(current),
      reserveCheckoutSlot: vi.fn().mockResolvedValue(reserved),
      attachCheckoutProvider: vi.fn().mockResolvedValue(attached),
      extendActive: vi.fn(),
    };
    const service = createService(repository, { createCheckout });

    const result = await service.renew(current.userId, {
      planId: quarterly.id,
    });

    expect(repository.extendActive).not.toHaveBeenCalled();
    expect(repository.reserveCheckoutSlot).toHaveBeenCalledWith(
      { id: current.id, pendingPlanId: quarterly.id },
      transactionClient,
    );
    expect(createCheckout.mock.invocationCallOrder[0]).toBeGreaterThan(
      repository.reserveCheckoutSlot.mock.invocationCallOrder[0],
    );
    expect(result.checkoutUrl).toBe('https://pay.example/renew');
    expect(result.subscription.currentPeriodEnd).toBe(periodEnd.toISOString());
  });

  it('resumes an in-flight delayed renew without creating another provider session', async () => {
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      code: '3_MONTHS',
      intervalMonths: 3,
    };
    const current = subscription({
      currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'),
      pendingPlanId: quarterly.id,
      providerReference: 'pay_renew',
      checkoutUrl: 'https://pay.example/renew',
    });
    const createCheckout = vi.fn();
    const setCheckoutUrl = vi.fn();
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(quarterly),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(current),
      reserveCheckoutSlot: vi.fn(),
      setCheckoutUrl,
      extendActive: vi.fn(),
    };
    const service = createService(repository, { createCheckout });

    const result = await service.renew(current.userId, {
      planId: quarterly.id,
    });

    expect(result.checkoutUrl).toBe('https://pay.example/renew');
    expect(createCheckout).not.toHaveBeenCalled();
    expect(setCheckoutUrl).not.toHaveBeenCalled();
    expect(repository.reserveCheckoutSlot).not.toHaveBeenCalled();
    expect(repository.extendActive).not.toHaveBeenCalled();
  });

  it('does not create a provider session when a delayed renew slot is already taken', async () => {
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      code: '3_MONTHS',
      intervalMonths: 3,
    };
    const current = subscription({
      currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'),
    });
    const createCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: 'https://pay.example/again',
      providerReference: 'pay_again',
      immediateConfirmation: false,
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(quarterly),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(current),
      reserveCheckoutSlot: vi.fn().mockResolvedValue(null),
      extendActive: vi.fn(),
    };
    const service = createService(repository, { createCheckout });

    await expect(
      service.renew(current.userId, { planId: quarterly.id }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_CHECKOUT_PENDING' },
    });
    expect(createCheckout).not.toHaveBeenCalled();
    expect(repository.extendActive).not.toHaveBeenCalled();
  });

  it('resumes an in-flight delayed pending checkout', async () => {
    const pending = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: 'pay_first',
      pendingPlanId: plan.id,
      currentPeriodEnd: null,
      checkoutUrl: 'https://pay.example/first',
    });
    const createCheckout = vi.fn();
    const setCheckoutUrl = vi.fn();
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(pending),
      reserveCheckoutSlot: vi.fn(),
      setCheckoutUrl,
      setPlan: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository, { createCheckout });

    const result = await service.renew(pending.userId, { planId: plan.id });

    expect(result.checkoutUrl).toBe('https://pay.example/first');
    expect(createCheckout).not.toHaveBeenCalled();
    expect(setCheckoutUrl).not.toHaveBeenCalled();
    expect(repository.reserveCheckoutSlot).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it('refreshes only an expired stored return url on explicit resume', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 1;
    const stored = `http://localhost:3000/checkout/return?providerReference=pay_first&expiresAt=${expiresAt}&signature=${signMockWebhook(
      CSRF_SECRET,
      'pay_first',
      expiresAt,
    )}`;
    const pending = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: 'pay_first',
      pendingPlanId: plan.id,
      currentPeriodEnd: null,
      checkoutUrl: stored,
    });
    const setCheckoutUrl = vi.fn(
      async (input: { id: string; checkoutUrl: string }) => ({
        ...pending,
        checkoutUrl: input.checkoutUrl,
      }),
    );
    const createCheckout = vi.fn();
    const service = createService(
      {
        findActivePlanById: vi.fn().mockResolvedValue(plan),
        expireLapsed: vi.fn().mockResolvedValue(0),
        findNonTerminalByUserId: vi.fn().mockResolvedValue(pending),
        setCheckoutUrl,
      },
      { createCheckout },
    );

    const result = await service.renew(pending.userId, { planId: plan.id });

    expectSignedReturnUrl(result.checkoutUrl, 'pay_first');
    expect(result.checkoutUrl).not.toBe(stored);
    expect(setCheckoutUrl).toHaveBeenCalled();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('does not change plan on a pending renew until payment confirms', async () => {
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      code: '3_MONTHS',
      intervalMonths: 3,
    };
    const pending = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const reserved = { ...pending, pendingPlanId: quarterly.id };
    const attached = {
      ...reserved,
      providerReference: 'pay_pending',
    };
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(quarterly),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(pending),
      setPlan: vi.fn(),
      reserveCheckoutSlot: vi.fn().mockResolvedValue(reserved),
      attachCheckoutProvider: vi.fn().mockResolvedValue(attached),
      activate: vi.fn(),
    };
    const service = createService(repository, {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/pending',
        providerReference: 'pay_pending',
        immediateConfirmation: false,
      }),
    });

    const result = await service.renew(pending.userId, {
      planId: quarterly.id,
    });

    expect(repository.setPlan).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.reserveCheckoutSlot).toHaveBeenCalledWith(
      { id: pending.id, pendingPlanId: quarterly.id },
      transactionClient,
    );
    expect(repository.attachCheckoutProvider).toHaveBeenCalledWith(
      {
        id: pending.id,
        pendingPlanId: quarterly.id,
        providerReference: 'pay_pending',
        checkoutUrl: 'https://pay.example/pending',
      },
      transactionClient,
    );
    expect(result.subscription.planId).toBe(plan.id);
    expect(result.checkoutUrl).toBe('https://pay.example/pending');
  });

  it('does not create a provider session when a pending checkout slot is already taken', async () => {
    const pending = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const createCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: 'https://pay.example/pending',
      providerReference: 'pay_pending',
      immediateConfirmation: false,
    });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(plan),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(pending),
      reserveCheckoutSlot: vi.fn().mockResolvedValue(null),
      setPlan: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository, { createCheckout });

    await expect(
      service.renew(pending.userId, { planId: plan.id }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_CHECKOUT_PENDING' },
    });
    expect(createCheckout).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it('applies a new plan on pending renew only after immediate confirmation', async () => {
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      code: '3_MONTHS',
      intervalMonths: 3,
    };
    const pending = subscription({
      status: SubscriptionStatus.PENDING,
      providerReference: null,
      currentPeriodEnd: null,
    });
    const switched = { ...pending, planId: quarterly.id, plan: quarterly };
    const activated = subscription({ planId: quarterly.id, plan: quarterly });
    const repository = {
      findActivePlanById: vi.fn().mockResolvedValue(quarterly),
      expireLapsed: vi.fn().mockResolvedValue(0),
      findNonTerminalByUserId: vi.fn().mockResolvedValue(pending),
      reserveCheckoutSlot: vi.fn().mockResolvedValue({
        ...pending,
        pendingPlanId: quarterly.id,
      }),
      setPlan: vi.fn().mockResolvedValue(switched),
      activate: vi.fn().mockResolvedValue(activated),
    };
    const service = createService(repository);

    await service.renew(pending.userId, { planId: quarterly.id });

    expect(repository.setPlan).toHaveBeenCalledWith(
      { id: pending.id, planId: quarterly.id },
      transactionClient,
    );
    expect(repository.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pending.id,
        planId: quarterly.id,
      }),
      transactionClient,
    );
  });
});

describe('SubscriptionsService.activateByProviderReference', () => {
  it('extends an already-ACTIVE subscription when a delayed renewal is pending', async () => {
    const periodEnd = new Date('2026-12-01T00:00:00.000Z');
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      intervalMonths: 3,
    };
    const current = subscription({
      currentPeriodEnd: periodEnd,
      pendingPlanId: quarterly.id,
      providerReference: 'pay_renew',
    });
    const extended = subscription({
      planId: quarterly.id,
      plan: quarterly,
      currentPeriodEnd: addCalendarMonths(periodEnd, 3),
      pendingPlanId: null,
    });
    const repository = {
      findByProviderReference: vi.fn().mockResolvedValue(current),
      findPlanById: vi.fn().mockResolvedValue(quarterly),
      claimPendingRenewal: vi.fn().mockResolvedValue(extended),
      extendActive: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository);

    const result = await service.activateByProviderReference('pay_renew');

    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.extendActive).not.toHaveBeenCalled();
    expect(repository.claimPendingRenewal).toHaveBeenCalledWith(
      {
        id: current.id,
        planId: quarterly.id,
        pendingPlanId: quarterly.id,
        currentPeriodEnd: addCalendarMonths(periodEnd, 3),
      },
      transactionClient,
    );
    expect(result.currentPeriodEnd).toBe(
      addCalendarMonths(periodEnd, 3).toISOString(),
    );
  });

  it('does not stack a delayed renewal when another webhook already claimed it', async () => {
    const periodEnd = new Date('2026-12-01T00:00:00.000Z');
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      intervalMonths: 3,
    };
    const pending = subscription({
      currentPeriodEnd: periodEnd,
      pendingPlanId: quarterly.id,
      providerReference: 'pay_renew',
    });
    const claimed = subscription({
      planId: quarterly.id,
      plan: quarterly,
      currentPeriodEnd: addCalendarMonths(periodEnd, 3),
      pendingPlanId: null,
      providerReference: 'pay_renew',
    });
    const repository = {
      findByProviderReference: vi
        .fn()
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(claimed),
      findPlanById: vi.fn().mockResolvedValue(quarterly),
      claimPendingRenewal: vi.fn().mockResolvedValue(null),
      extendActive: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository);

    const result = await service.activateByProviderReference('pay_renew');

    expect(repository.claimPendingRenewal).toHaveBeenCalled();
    expect(repository.extendActive).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
    expect(result.currentPeriodEnd).toBe(
      claimed.currentPeriodEnd?.toISOString(),
    );
  });

  it('does not reactivate an expired subscription', async () => {
    const expired = subscription({
      status: SubscriptionStatus.EXPIRED,
      providerReference: 'pay_old',
      pendingPlanId: null,
    });
    const repository = {
      findByProviderReference: vi.fn().mockResolvedValue(expired),
      activate: vi.fn(),
      claimPendingRenewal: vi.fn(),
    };
    const service = createService(repository);

    await expect(
      service.activateByProviderReference('pay_old'),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_NOT_CONFIRMABLE' },
    });
    expect(repository.activate).not.toHaveBeenCalled();
  });
});

describe('SubscriptionsService.completeMockPayment', () => {
  it('completes a delayed renewal when the mock signature is valid', async () => {
    const periodEnd = new Date('2026-12-01T00:00:00.000Z');
    const quarterly = {
      ...plan,
      id: '44444444-4444-4444-8444-444444444444',
      intervalMonths: 3,
    };
    const current = subscription({
      currentPeriodEnd: periodEnd,
      pendingPlanId: quarterly.id,
      providerReference: 'pay_renew',
    });
    const extended = subscription({
      planId: quarterly.id,
      plan: quarterly,
      currentPeriodEnd: addCalendarMonths(periodEnd, 3),
      pendingPlanId: null,
    });
    const repository = {
      findByProviderReference: vi.fn().mockResolvedValue(current),
      findPlanById: vi.fn().mockResolvedValue(quarterly),
      claimPendingRenewal: vi.fn().mockResolvedValue(extended),
      extendActive: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository);

    const result = await service.completeMockPayment(
      signedWebhook('pay_renew'),
    );

    expect(repository.claimPendingRenewal).toHaveBeenCalled();
    expect(result.planId).toBe(quarterly.id);
  });

  it('rejects a mock webhook with a forged signature', async () => {
    const repository = {
      findByProviderReference: vi.fn(),
      claimPendingRenewal: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository);

    await expect(
      service.completeMockPayment({
        providerReference: 'pay_renew',
        expiresAt: mockWebhookExpiresAt(),
        signature: 'forged',
      }),
    ).rejects.toMatchObject({
      response: { code: 'PAYMENT_SIGNATURE_INVALID' },
    });
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it('hides the mock webhook in production', async () => {
    const repository = {
      findByProviderReference: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository, undefined, {
      get: (key: string) => (key === 'NODE_ENV' ? 'production' : undefined),
    });

    await expect(
      service.completeMockPayment({
        providerReference: 'pay_renew',
        expiresAt: mockWebhookExpiresAt(),
        signature: 'anything',
      }),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it('does not complete payment for an expired subscription', async () => {
    const expired = subscription({
      status: SubscriptionStatus.EXPIRED,
      providerReference: 'pay_old',
      pendingPlanId: null,
    });
    const repository = {
      findByProviderReference: vi.fn().mockResolvedValue(expired),
      activate: vi.fn(),
    };
    const service = createService(repository);

    await expect(
      service.completeMockPayment(signedWebhook('pay_old')),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_NOT_CONFIRMABLE' },
    });
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it('rejects an expired mock signature', async () => {
    const repository = {
      findByProviderReference: vi.fn(),
      activate: vi.fn(),
    };
    const service = createService(repository);
    const expiresAt = Math.floor(Date.now() / 1000) - 1;

    await expect(
      service.completeMockPayment({
        providerReference: 'pay_renew',
        expiresAt,
        signature: signMockWebhook(CSRF_SECRET, 'pay_renew', expiresAt),
      }),
    ).rejects.toMatchObject({
      response: { code: 'PAYMENT_SIGNATURE_EXPIRED' },
    });
    expect(repository.activate).not.toHaveBeenCalled();
  });
});
