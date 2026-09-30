import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus, type Plan } from '@prisma/client';
import type {
  CheckoutInput,
  GrantSubscriptionInput,
  MockPaymentWebhookInput,
} from '@repo/validation';
import type {
  CheckoutResponse,
  CurrentSubscriptionResponse,
  PlanResponse,
  SubscriptionResponse,
} from '@repo/shared-types';
import { AppConfigService } from '../config/app-config.service.js';
import { addCalendarMonths } from './period.js';
import {
  PAYMENT_PROVIDER,
  type CheckoutResult,
  type PaymentProvider,
} from './providers/payment-provider.interface.js';
import {
  isMockWebhookExpired,
  mockWebhookExpiresAt,
  signMockWebhook,
  verifyMockWebhook,
} from './providers/mock-webhook-signature.js';
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
    private readonly config: AppConfigService,
  ) {}

  listPlans(): Promise<PlanResponse[]> {
    return this.subscriptions
      .listActivePlans()
      .then((plans) => plans.map(toPlanResponse));
  }

  async getMine(userId: string): Promise<CurrentSubscriptionResponse> {
    const subscription = await this.findCurrent(userId);
    return {
      subscription: subscription ? toSubscriptionResponse(subscription) : null,
      checkoutUrl: this.storedCheckoutUrl(subscription),
    };
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

  async completeMockPayment(
    input: MockPaymentWebhookInput,
  ): Promise<SubscriptionResponse> {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Not found',
      });
    }
    if (
      !verifyMockWebhook(
        this.config.get('CSRF_SECRET'),
        input.providerReference,
        input.expiresAt,
        input.signature,
      )
    ) {
      throw new ForbiddenException({
        code: 'PAYMENT_SIGNATURE_INVALID',
        message: 'Payment signature is invalid',
      });
    }
    if (isMockWebhookExpired(input.expiresAt)) {
      throw new ForbiddenException({
        code: 'PAYMENT_SIGNATURE_EXPIRED',
        message: 'Payment signature has expired',
      });
    }
    return this.activateByProviderReference(input.providerReference);
  }

  async activateByProviderReference(
    providerReference: string,
  ): Promise<SubscriptionResponse> {
    return this.subscriptions.transaction(async (transaction) => {
      const subscription = await this.subscriptions.findByProviderReference(
        providerReference,
        transaction,
      );
      if (!subscription) {
        throw new NotFoundException({
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No subscription matches this provider reference',
        });
      }

      if (subscription.status === SubscriptionStatus.ACTIVE) {
        if (!subscription.pendingPlanId) {
          return toSubscriptionResponse(subscription);
        }
        if (!subscription.currentPeriodEnd) {
          throw new ConflictException({
            code: 'SUBSCRIPTION_PERIOD_MISSING',
            message: 'Active subscription has no period end to extend',
          });
        }
        const plan = await this.subscriptions.findPlanById(
          subscription.pendingPlanId,
          transaction,
        );
        if (!plan) {
          throw new NotFoundException({
            code: 'PLAN_NOT_FOUND',
            message: 'The requested plan does not exist',
          });
        }
        const extended = await this.subscriptions.claimPendingRenewal(
          {
            id: subscription.id,
            planId: plan.id,
            pendingPlanId: plan.id,
            currentPeriodEnd: addCalendarMonths(
              subscription.currentPeriodEnd,
              plan.intervalMonths,
            ),
          },
          transaction,
        );
        if (!extended) {
          const current = await this.subscriptions.findByProviderReference(
            providerReference,
            transaction,
          );
          if (!current) {
            throw new NotFoundException({
              code: 'SUBSCRIPTION_NOT_FOUND',
              message: 'No subscription matches this provider reference',
            });
          }
          return toSubscriptionResponse(current);
        }
        return toSubscriptionResponse(extended);
      }

      if (subscription.status !== SubscriptionStatus.PENDING) {
        throw new ConflictException({
          code: 'SUBSCRIPTION_NOT_CONFIRMABLE',
          message: 'This payment cannot be completed',
        });
      }

      const planId = subscription.pendingPlanId ?? subscription.planId;
      const plan = await this.subscriptions.findPlanById(planId, transaction);
      if (!plan) {
        throw new NotFoundException({
          code: 'PLAN_NOT_FOUND',
          message: 'The requested plan does not exist',
        });
      }

      const activated = await this.subscriptions.activate(
        {
          id: subscription.id,
          providerReference,
          currentPeriodEnd:
            subscription.currentPeriodEnd ??
            addCalendarMonths(new Date(), plan.intervalMonths),
          planId,
        },
        transaction,
      );
      return toSubscriptionResponse(activated);
    });
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
    if (current.pendingPlanId && current.providerReference) {
      return this.resumeStoredCheckout(current);
    }
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

    return this.subscriptions.transaction(async (transaction) => {
      if (checkout.immediateConfirmation) {
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
          return {
            subscription: toSubscriptionResponse(subscription),
            checkoutUrl: this.resolveCheckoutUrl(checkout),
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
            currentPeriodEnd: addCalendarMonths(
              new Date(),
              plan.intervalMonths,
            ),
            planId: plan.id,
          },
          transaction,
        );
        return {
          subscription: toSubscriptionResponse(subscription),
          checkoutUrl: this.resolveCheckoutUrl(checkout),
        };
      }

      const attached = await this.subscriptions.attachCheckoutProvider(
        {
          id: reserved.id,
          pendingPlanId: reserved.pendingPlanId ?? plan.id,
          providerReference: checkout.providerReference,
          checkoutUrl: this.resolveCheckoutUrl(checkout),
        },
        transaction,
      );
      if (!attached) {
        throw checkoutPendingConflict();
      }
      return {
        subscription: toSubscriptionResponse(attached),
        checkoutUrl: this.resolveCheckoutUrl(checkout),
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

  private storedCheckoutUrl(
    subscription: SubscriptionWithPlan | null,
  ): string | null {
    if (!subscription?.pendingPlanId) {
      return null;
    }
    return subscription.checkoutUrl;
  }

  private async resumeStoredCheckout(
    current: SubscriptionWithPlan,
  ): Promise<CheckoutResponse> {
    const stored = current.checkoutUrl;
    if (!stored || this.isHostedCheckoutUrl(stored)) {
      return {
        subscription: toSubscriptionResponse(current),
        checkoutUrl: stored,
      };
    }

    const expiresAt = this.signedReturnExpiresAt(stored);
    if (expiresAt === null || !isMockWebhookExpired(expiresAt)) {
      return {
        subscription: toSubscriptionResponse(current),
        checkoutUrl: stored,
      };
    }

    const refreshed = current.providerReference
      ? this.signedReturnUrl(current.providerReference)
      : null;
    if (!refreshed) {
      return {
        subscription: toSubscriptionResponse(current),
        checkoutUrl: stored,
      };
    }
    const updated = await this.subscriptions.setCheckoutUrl({
      id: current.id,
      checkoutUrl: refreshed,
    });
    return {
      subscription: toSubscriptionResponse(updated),
      checkoutUrl: refreshed,
    };
  }

  private isHostedCheckoutUrl(checkoutUrl: string | null): boolean {
    if (!checkoutUrl) {
      return false;
    }
    try {
      return new URL(checkoutUrl).pathname !== '/checkout/return';
    } catch {
      return true;
    }
  }

  private signedReturnExpiresAt(checkoutUrl: string): number | null {
    try {
      const expiresAt = Number(
        new URL(checkoutUrl).searchParams.get('expiresAt'),
      );
      return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null;
    } catch {
      return null;
    }
  }

  private resolveCheckoutUrl(checkout: CheckoutResult): string | null {
    if (checkout.immediateConfirmation || checkout.checkoutUrl) {
      return checkout.checkoutUrl;
    }
    return this.signedReturnUrl(checkout.providerReference);
  }

  private signedReturnUrl(providerReference: string): string | null {
    // First listed WEB_ORIGINS entry, not the request Host. Fine while there is
    // one origin; a staging+prod list would send staging users to prod.
    const origin = this.config
      .get('WEB_ORIGINS')
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);
    if (!origin) {
      return null;
    }
    const expiresAt = mockWebhookExpiresAt();
    const returnUrl = new URL('/checkout/return', origin);
    returnUrl.searchParams.set('providerReference', providerReference);
    returnUrl.searchParams.set('expiresAt', String(expiresAt));
    returnUrl.searchParams.set(
      'signature',
      signMockWebhook(
        this.config.get('CSRF_SECRET'),
        providerReference,
        expiresAt,
      ),
    );
    return returnUrl.toString();
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
