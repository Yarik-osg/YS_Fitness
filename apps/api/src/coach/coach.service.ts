import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, type Prisma } from '@prisma/client';
import type {
  CoachClientDetail,
  CoachClientOnboarding,
  CoachClientSummary,
  CoachClientsResponse,
} from '@repo/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EXPERIENCE_FROM_PRISMA,
  PROGRAM_TRACK_FROM_PRISMA,
  toOnboardingResponsesRecord,
} from '../users/onboarding-responses.mapper.js';
import {
  activeAccessWhere,
  grantsActiveAccess,
} from '../subscriptions/subscription-access.js';

const clientDetailSelect = {
  id: true,
  email: true,
  createdAt: true,
  profile: {
    select: {
      name: true,
      dateOfBirth: true,
      biologicalSexForCalculation: true,
      heightCm: true,
      activityLevel: true,
      goal: true,
      timezone: true,
      onboardingCompletedAt: true,
    },
  },
  onboardingResponses: {
    select: {
      programTrack: true,
      currentBody: true,
      desiredBody: true,
      mainGoal: true,
      experience: true,
      trainingFrequency: true,
      focusAreas: true,
      nutritionCurrent: true,
      mealsPerDay: true,
      eatingHabits: true,
      physiqueLevel: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  workoutProgram: {
    select: {
      assignedAt: true,
      template: {
        select: {
          code: true,
          name: true,
          gender: true,
          level: true,
          frequencyPerWeek: true,
          accent: true,
        },
      },
    },
  },
  subscriptions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      status: true,
      currentPeriodEnd: true,
      plan: { select: { name: true } },
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class CoachService {
  constructor(private readonly prisma: PrismaService) {}

  async listClients(): Promise<CoachClientsResponse> {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: { role: UserRole.CLIENT },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        email: true,
        createdAt: true,
        profile: { select: { name: true, onboardingCompletedAt: true } },
        workoutProgram: { select: { id: true } },
        subscriptions: {
          where: activeAccessWhere(now),
          select: { id: true },
          take: 1,
        },
      },
    });

    return { clients: users.map(toSummary) };
  }

  async getClient(userId: string): Promise<CoachClientDetail> {
    const now = new Date();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.CLIENT },
      select: clientDetailSelect,
    });
    if (!user) {
      throw new NotFoundException({
        code: 'CLIENT_NOT_FOUND',
        message: 'Client not found.',
      });
    }
    return toDetail(user, now);
  }
}

function toSummary(user: {
  id: string;
  email: string;
  createdAt: Date;
  profile: { name: string | null; onboardingCompletedAt: Date | null } | null;
  workoutProgram: { id: string } | null;
  subscriptions: { id: string }[];
}): CoachClientSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.profile?.name ?? null,
    createdAt: user.createdAt.toISOString(),
    onboardingCompleted: user.profile?.onboardingCompletedAt != null,
    programAssigned: user.workoutProgram != null,
    subscriptionActive: user.subscriptions.length > 0,
  };
}

type ClientDetailRow = Prisma.UserGetPayload<{
  select: typeof clientDetailSelect;
}>;

function toDetail(user: ClientDetailRow, now: Date): CoachClientDetail {
  const subscription = user.subscriptions[0] ?? null;
  const record = user.onboardingResponses
    ? toOnboardingResponsesRecord(user.onboardingResponses)
    : null;
  const onboarding: CoachClientOnboarding | null = record
    ? {
        programTrack: record.programTrack,
        currentBody: record.currentBody,
        desiredBody: record.desiredBody,
        mainGoal: record.mainGoal,
        experience: record.experience,
        trainingFrequency: record.trainingFrequency,
        focusAreas: record.focusAreas,
        nutritionCurrent: record.nutritionCurrent,
        mealsPerDay: record.mealsPerDay,
        eatingHabits: record.eatingHabits,
        physiqueLevel: record.physiqueLevel,
      }
    : null;
  const template = user.workoutProgram?.template;

  return {
    id: user.id,
    email: user.email,
    name: user.profile?.name ?? null,
    createdAt: user.createdAt.toISOString(),
    onboardingCompleted: user.profile?.onboardingCompletedAt != null,
    profile: user.profile
      ? {
          dateOfBirth: user.profile.dateOfBirth.toISOString().slice(0, 10),
          biologicalSexForCalculation: user.profile.biologicalSexForCalculation,
          heightCm: user.profile.heightCm.toNumber(),
          activityLevel: user.profile.activityLevel,
          goal: user.profile.goal,
          timezone: user.profile.timezone,
        }
      : null,
    onboarding,
    program:
      user.workoutProgram && template
        ? {
            accent: template.accent,
            templateCode: template.code,
            templateName: template.name,
            level: EXPERIENCE_FROM_PRISMA[template.level],
            frequencyPerWeek: template.frequencyPerWeek,
            gender: PROGRAM_TRACK_FROM_PRISMA[template.gender],
            assignedAt: user.workoutProgram.assignedAt.toISOString(),
          }
        : null,
    subscription: subscription
      ? {
          active: grantsActiveAccess(subscription, now),
          status: subscription.status,
          planName: subscription.plan.name,
          currentPeriodEnd:
            subscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
  };
}
