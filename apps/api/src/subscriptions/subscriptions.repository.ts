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

type Client = Prisma.TransactionClient;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  listActivePlans(client: Client = this.prisma): Promise<Plan[]> {
    return client.plan.findMany({
      where: { isActive: true },
      orderBy: [{ intervalMonths: 'desc' }, { priceAmount: 'asc' }],
    });
  }

  findActivePlanById(
    id: string,
    client: Client = this.prisma,
  ): Promise<Plan | null> {
    return client.plan.findFirst({
      where: { id, isActive: true },
    });
  }

  async expireLapsed(
    userId: string,
    now: Date,
    client: Client = this.prisma,
  ): Promise<number> {
    const { count } = await client.subscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lte: now },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    return count;
  }

  findNonTerminalByUserId(
    userId: string,
    client: Client = this.prisma,
  ): Promise<SubscriptionWithPlan | null> {
    return client.subscription.findFirst({
      where: {
        userId,
        status: { in: NON_TERMINAL_STATUSES },
      },
      ...subscriptionWithPlan,
    });
  }

  createPending(
    input: { userId: string; planId: string },
    client: Client = this.prisma,
  ): Promise<SubscriptionWithPlan> {
    return client.subscription.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        status: SubscriptionStatus.PENDING,
        provider: PaymentProvider.MOCK,
      },
      ...subscriptionWithPlan,
    });
  }

  createManualGrant(
    input: {
      userId: string;
      planId: string;
      grantedByUserId: string;
      currentPeriodEnd: Date;
    },
    client: Client = this.prisma,
  ): Promise<SubscriptionWithPlan> {
    return client.subscription.create({
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

  async extendActive(
    input: {
      id: string;
      planId: string;
      currentPeriodEnd: Date;
      providerReference?: string;
      pendingPlanId?: string | null;
    },
    client: Client = this.prisma,
  ): Promise<SubscriptionWithPlan | null> {
    const { count } = await client.subscription.updateMany({
      where: {
        id: input.id,
        status: SubscriptionStatus.ACTIVE,
        pendingPlanId: { not: null },
      },
      data: {
        planId: input.planId,
        currentPeriodEnd: input.currentPeriodEnd,
        pendingPlanId:
          input.pendingPlanId === undefined ? undefined : input.pendingPlanId,
        ...(input.providerReference
          ? { providerReference: input.providerReference }
          : {}),
      },
    });
    if (count === 0) return null;
    return client.subscription.findUniqueOrThrow({
      where: { id: input.id },
      ...subscriptionWithPlan,
    });
  }

  async reserveCheckoutSlot(
    input: { id: string; pendingPlanId: string },
    client: Client = this.prisma,
  ): Promise<SubscriptionWithPlan | null> {
    const { count } = await client.subscription.updateMany({
      where: {
        id: input.id,
        pendingPlanId: null,
        status: {
          in: [SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE],
        },
      },
      data: { pendingPlanId: input.pendingPlanId },
    });
    if (count === 0) return null;
    return client.subscription.findUniqueOrThrow({
      where: { id: input.id },
      ...subscriptionWithPlan,
    });
  }

  setPlan(
    input: { id: string; planId: string },
    client: Client = this.prisma,
  ): Promise<SubscriptionWithPlan> {
    return client.subscription.update({
      where: { id: input.id },
      data: { planId: input.planId },
      ...subscriptionWithPlan,
    });
  }

  async activate(
    input: {
      id: string;
      providerReference: string;
      currentPeriodEnd: Date;
      planId?: string;
    },
    client: Client = this.prisma,
  ): Promise<SubscriptionWithPlan | null> {
    const { count } = await client.subscription.updateMany({
      where: {
        id: input.id,
        status: SubscriptionStatus.PENDING,
        pendingPlanId: { not: null },
      },
      data: {
        status: SubscriptionStatus.ACTIVE,
        providerReference: input.providerReference,
        currentPeriodEnd: input.currentPeriodEnd,
        pendingPlanId: null,
        ...(input.planId ? { planId: input.planId } : {}),
      },
    });
    if (count === 0) return null;
    return client.subscription.findUniqueOrThrow({
      where: { id: input.id },
      ...subscriptionWithPlan,
    });
  }

  findPlanById(id: string, client: Client = this.prisma): Promise<Plan | null> {
    return client.plan.findUnique({ where: { id } });
  }

  findUserId(
    userId: string,
    client: Client = this.prisma,
  ): Promise<{ id: string } | null> {
    return client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
  }
}
