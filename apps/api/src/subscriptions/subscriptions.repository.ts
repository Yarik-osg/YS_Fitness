import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  Prisma,
  SubscriptionStatus,
  type Plan,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const NON_TERMINAL_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PENDING,
  SubscriptionStatus.ACTIVE,
];

const subscriptionWithPlan = {
  include: { plan: true },
} satisfies Prisma.SubscriptionDefaultArgs;

export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<
  typeof subscriptionWithPlan
>;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActivePlans(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ intervalMonths: 'desc' }, { priceAmount: 'asc' }],
    });
  }

  findActivePlanById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findFirst({
      where: { id, isActive: true },
    });
  }

  findNonTerminalByUserId(
    userId: string,
  ): Promise<SubscriptionWithPlan | null> {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: NON_TERMINAL_STATUSES },
      },
      ...subscriptionWithPlan,
    });
  }

  createPending(input: {
    userId: string;
    planId: string;
  }): Promise<SubscriptionWithPlan> {
    return this.prisma.subscription.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        status: SubscriptionStatus.PENDING,
        provider: PaymentProvider.MOCK,
      },
      ...subscriptionWithPlan,
    });
  }

  createManualGrant(input: {
    userId: string;
    planId: string;
    grantedByUserId: string;
    currentPeriodEnd: Date;
  }): Promise<SubscriptionWithPlan> {
    return this.prisma.subscription.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        status: SubscriptionStatus.ACTIVE,
        provider: PaymentProvider.MANUAL,
        grantedByUserId: input.grantedByUserId,
        currentPeriodEnd: input.currentPeriodEnd,
      },
      ...subscriptionWithPlan,
    });
  }

  activate(input: {
    id: string;
    providerReference: string;
    currentPeriodEnd: Date;
  }): Promise<SubscriptionWithPlan> {
    return this.prisma.subscription.update({
      where: { id: input.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        providerReference: input.providerReference,
        currentPeriodEnd: input.currentPeriodEnd,
      },
      ...subscriptionWithPlan,
    });
  }

  findByProviderReference(
    providerReference: string,
  ): Promise<SubscriptionWithPlan | null> {
    return this.prisma.subscription.findFirst({
      where: { providerReference },
      ...subscriptionWithPlan,
    });
  }

  findUserId(userId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
  }
}
