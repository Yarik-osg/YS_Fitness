import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus, type Plan } from '@prisma/client';
import type { CheckoutInput, GrantSubscriptionInput } from '@repo/validation';
import type {
  CheckoutResponse,
  PlanResponse,
  SubscriptionResponse,
} from '@repo/shared-types';
import { addCalendarMonths } from './period.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './providers/payment-provider.interface.js';
import {
  SubscriptionsRepository,
  type SubscriptionWithPlan,
} from './subscriptions.repository.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
  ) {}

  listPlans(): Promise<PlanResponse[]> {
    return this.subscriptions
      .listActivePlans()
      .then((plans) => plans.map(toPlanResponse));
  }

  async getMine(userId: string): Promise<SubscriptionResponse | null> {
    const subscription = await this.findCurrent(userId);
    return subscription ? toSubscriptionResponse(subscription) : null;
  }

  async hasActiveAccess(userId: string): Promise<boolean> {
    const subscription = await this.findCurrent(userId);
    return isActiveAccess(subscription);
  }

  async checkout(
    userId: string,
    input: CheckoutInput,
  ): Promise<CheckoutResponse> {
    const plan = await this.requireActivePlan(input.planId);

    try {
      const existing = await this.findCurrent(userId);
      if (existing) {
        return this.resumeOrContinueCheckout(existing, plan);
      }
      return await this.beginNewCheckout(userId, plan);
    } catch (error) {
      rethrowSubscriptionConflict(error);
    }
  }

  async renew(userId: string, input: CheckoutInput): Promise<CheckoutResponse> {
    const plan = await this.requireActivePlan(input.planId);

    try {
      await this.subscriptions.expireLapsed(userId, new Date());
      const current = await this.subscriptions.findNonTerminalByUserId(userId);
      if (!current) {
        return await this.beginNewCheckout(userId, plan);
      }
      if (current.status === SubscriptionStatus.PENDING) {
        return this.resumeOrContinueCheckout(current, plan);
      }
      if (current.status !== SubscriptionStatus.ACTIVE) {
        throw alreadyActiveConflict();
      }
      if (current.pendingPlanId) {
        return this.resumeOrContinueCheckout(current, plan);
      }
      if (!current.currentPeriodEnd) {
        throw new ConflictException({
          code: 'SUBSCRIPTION_PERIOD_MISSING',
          message: 'Active subscription has no period end to extend',
        });
      }

      const reserved = await this.subscriptions.transaction(
        async (transaction) =>
          this.reserveCheckoutSlot(
            { id: current.id, pendingPlanId: plan.id },
            transaction,
          ),
      );
      return await this.finishReservedCheckout(reserved, plan, {
        extendFrom: current.currentPeriodEnd,
      });
    } catch (error) {
      rethrowSubscriptionConflict(error);
    }
  }

  async grant(
    grantedByUserId: string,
    input: GrantSubscriptionInput,
  ): Promise<SubscriptionResponse> {
    const plan = await this.requireActivePlan(input.planId);
    const user = await this.subscriptions.findUserId(input.userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'The target user does not exist',
      });
    }

    const currentPeriodEnd = input.expiresAt
      ? new Date(input.expiresAt)
      : addCalendarMonths(new Date(), plan.intervalMonths);

    try {
      return await this.subscriptions.transaction(async (transaction) => {
        await this.assertNoNonTerminal(input.userId, transaction);
        const subscription = await this.subscriptions.createManualGrant(
          {
            userId: input.userId,
            planId: plan.id,
            grantedByUserId,
            currentPeriodEnd,
          },
          transaction,
        );
        return toSubscriptionResponse(subscription);
      });
    } catch (error) {
      rethrowSubscriptionConflict(error);
    }
  }

  private async requireActivePlan(planId: string): Promise<Plan> {
    const plan = await this.subscriptions.findActivePlanById(planId);
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'The requested plan does not exist',
      });
    }
    return plan;
  }

  private resumeOrContinueCheckout(
    current: SubscriptionWithPlan,
    plan: Plan,
  ): Promise<CheckoutResponse> {
    if (current.pendingPlanId) {
      return this.finishReservedCheckout(current, plan);
    }
    if (current.status === SubscriptionStatus.PENDING) {
      return this.subscriptions
        .transaction(async (transaction) =>
          this.reserveCheckoutSlot(
            { id: current.id, pendingPlanId: plan.id },
            transaction,
          ),
        )
        .then((reserved) => this.finishReservedCheckout(reserved, plan));
    }
    throw alreadyActiveConflict();
  }

  private async beginNewCheckout(
    userId: string,
    plan: Plan,
  ): Promise<CheckoutResponse> {
    const reserved = await this.subscriptions.transaction(
      async (transaction) => {
        await this.assertNoNonTerminal(userId, transaction);
        const created = await this.subscriptions.createPending(
          { userId, planId: plan.id },
          transaction,
        );
        return this.reserveCheckoutSlot(
          { id: created.id, pendingPlanId: plan.id },
          transaction,
        );
      },
    );
    return this.finishReservedCheckout(reserved, plan);
  }

  private async finishReservedCheckout(
    reserved: SubscriptionWithPlan,
    plan: Plan,
    options: { extendFrom?: Date } = {},
  ): Promise<CheckoutResponse> {
    const checkout = await this.paymentProvider.createCheckout({
      subscriptionId: reserved.id,
      planIntervalMonths: plan.intervalMonths,
    });

    if (!checkout.immediateConfirmation) {
      throw new ConflictException({
        code: 'CHECKOUT_NOT_CONFIRMED',
        message: 'Payment was not confirmed',
      });
    }

    return this.subscriptions.transaction(async (transaction) => {
      if (options.extendFrom) {
        const subscription = await this.subscriptions.extendActive(
          {
            id: reserved.id,
            planId: plan.id,
            currentPeriodEnd: addCalendarMonths(
              options.extendFrom,
              plan.intervalMonths,
            ),
            providerReference: checkout.providerReference,
            pendingPlanId: null,
          },
          transaction,
        );
        if (!subscription) {
          throw alreadyActiveConflict();
        }
        return {
          subscription: toSubscriptionResponse(subscription),
          checkoutUrl: checkout.checkoutUrl,
        };
      }

      let pending = reserved;
      if (
        reserved.status === SubscriptionStatus.PENDING &&
        pending.planId !== plan.id
      ) {
        pending = await this.subscriptions.setPlan(
          { id: pending.id, planId: plan.id },
          transaction,
        );
      }

      const subscription = await this.subscriptions.activate(
        {
          id: pending.id,
          providerReference: checkout.providerReference,
          currentPeriodEnd: addCalendarMonths(new Date(), plan.intervalMonths),
          planId: plan.id,
        },
        transaction,
      );
      if (!subscription) {
        throw alreadyActiveConflict();
      }
      return {
        subscription: toSubscriptionResponse(subscription),
        checkoutUrl: checkout.checkoutUrl,
      };
    });
  }

  private async reserveCheckoutSlot(
    input: { id: string; pendingPlanId: string },
    transaction: Prisma.TransactionClient,
  ): Promise<SubscriptionWithPlan> {
    const reserved = await this.subscriptions.reserveCheckoutSlot(
      input,
      transaction,
    );
    if (!reserved) {
      throw checkoutPendingConflict();
    }
    return reserved;
  }

  private async findCurrent(
    userId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<SubscriptionWithPlan | null> {
    await this.subscriptions.expireLapsed(userId, new Date(), transaction);
    return this.subscriptions.findNonTerminalByUserId(userId, transaction);
  }

  private async assertNoNonTerminal(
    userId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    const existing = await this.findCurrent(userId, transaction);
    if (existing) {
      throw alreadyActiveConflict();
    }
  }
}

function alreadyActiveConflict(): ConflictException {
  return new ConflictException({
    code: 'SUBSCRIPTION_ALREADY_ACTIVE',
    message: 'An active or pending subscription already exists for this user',
  });
}

function checkoutPendingConflict(): ConflictException {
  return new ConflictException({
    code: 'SUBSCRIPTION_CHECKOUT_PENDING',
    message: 'A checkout is already waiting for payment',
  });
}

function rethrowSubscriptionConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw alreadyActiveConflict();
  }

  if (isPostgresUniqueViolation(error)) {
    throw alreadyActiveConflict();
  }

  throw error;
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

function isActiveAccess(subscription: SubscriptionWithPlan | null): boolean {
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return false;
  }
  if (!subscription.currentPeriodEnd) {
    return false;
  }
  return subscription.currentPeriodEnd > new Date();
}

function toPlanResponse(plan: Plan): PlanResponse {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    priceAmount: plan.priceAmount,
    currency: plan.currency,
    intervalMonths: plan.intervalMonths,
    isActive: plan.isActive,
  };
}

function toSubscriptionResponse(
  subscription: SubscriptionWithPlan,
): SubscriptionResponse {
  return {
    id: subscription.id,
    userId: subscription.userId,
    planId: subscription.planId,
    status: subscription.status,
    provider: subscription.provider,
    providerReference: subscription.providerReference,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    grantedByUserId: subscription.grantedByUserId,
    createdAt: subscription.createdAt.toISOString(),
    plan: toPlanResponse(subscription.plan),
  };
}
