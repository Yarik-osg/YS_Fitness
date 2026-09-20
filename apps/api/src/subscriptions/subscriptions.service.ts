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
    const subscription =
      await this.subscriptions.findNonTerminalByUserId(userId);
    return subscription ? toSubscriptionResponse(subscription) : null;
  }

  async hasActiveAccess(userId: string): Promise<boolean> {
    const subscription =
      await this.subscriptions.findNonTerminalByUserId(userId);
    return isActiveAccess(subscription);
  }

  async checkout(
    userId: string,
    input: CheckoutInput,
  ): Promise<CheckoutResponse> {
    const plan = await this.requireActivePlan(input.planId);
    await this.assertNoNonTerminal(userId);

    let subscription: SubscriptionWithPlan;
    try {
      subscription = await this.subscriptions.createPending({
        userId,
        planId: plan.id,
      });
    } catch (error) {
      rethrowSubscriptionConflict(error);
    }

    const checkout = await this.paymentProvider.createCheckout({
      subscriptionId: subscription.id,
      planIntervalMonths: plan.intervalMonths,
    });

    if (checkout.immediateConfirmation) {
      subscription = await this.subscriptions.activate({
        id: subscription.id,
        providerReference: checkout.providerReference,
        currentPeriodEnd: addCalendarMonths(new Date(), plan.intervalMonths),
      });
    }

    return {
      subscription: toSubscriptionResponse(subscription),
      checkoutUrl: checkout.checkoutUrl,
    };
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

    await this.assertNoNonTerminal(input.userId);

    const currentPeriodEnd = input.expiresAt
      ? new Date(input.expiresAt)
      : addCalendarMonths(new Date(), plan.intervalMonths);

    try {
      const subscription = await this.subscriptions.createManualGrant({
        userId: input.userId,
        planId: plan.id,
        grantedByUserId,
        currentPeriodEnd,
      });
      return toSubscriptionResponse(subscription);
    } catch (error) {
      rethrowSubscriptionConflict(error);
    }
  }

  async activateByProviderReference(
    providerReference: string,
  ): Promise<SubscriptionResponse> {
    const subscription =
      await this.subscriptions.findByProviderReference(providerReference);
    if (!subscription) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'No subscription matches this provider reference',
      });
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return toSubscriptionResponse(subscription);
    }

    const activated = await this.subscriptions.activate({
      id: subscription.id,
      providerReference,
      currentPeriodEnd:
        subscription.currentPeriodEnd ??
        addCalendarMonths(new Date(), subscription.plan.intervalMonths),
    });
    return toSubscriptionResponse(activated);
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

  private async assertNoNonTerminal(userId: string): Promise<void> {
    const existing = await this.subscriptions.findNonTerminalByUserId(userId);
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
