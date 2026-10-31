import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionStatus, UserRole, type Prisma } from '@prisma/client';
import type {
  CoachClientDetail,
  CoachClientOnboarding,
  CoachClientSummary,
  CoachClientWorkoutLog,
  CoachClientWorkoutsResponse,
  CoachClientsResponse,
  CoachProgramClientsResponse,
  ProgressPhotosResponse,
  StrengthChangesResponse,
  WeightMeasurementsResponse,
} from '@repo/shared-types';
import type {
  ListWorkoutLogsQuery,
  UpdateCoachNoteInput,
} from '@repo/validation';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgramsService } from '../programs/programs.service.js';
import { UsersService } from '../users/users.service.js';
import { WorkoutsService } from '../workouts/workouts.service.js';
import {
  EXPERIENCE_FROM_PRISMA,
  PROGRAM_TRACK_FROM_PRISMA,
  toOnboardingResponsesRecord,
} from '../users/onboarding-responses.mapper.js';
import { grantsActiveAccess } from '../subscriptions/subscription-access.js';

const clientDetailSelect = {
  id: true,
  email: true,
  isActive: true,
  coachNote: true,
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
      assignmentSource: true,
      template: {
        select: {
          code: true,
          name: true,
          gender: true,
          level: true,
          frequencyPerWeek: true,
          accent: true,
          origin: true,
        },
      },
    },
  },
  subscriptions: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      status: true,
      currentPeriodEnd: true,
      plan: { select: { name: true } },
    },
  },
} satisfies Prisma.UserSelect;

const workoutHistorySelect = {
  id: true,
  completedAt: true,
  dayNumber: true,
  templateCode: true,
  templateName: true,
  template: { select: { code: true, name: true } },
  sets: {
    orderBy: [{ order: 'asc' as const }, { setNumber: 'asc' as const }],
    select: {
      order: true,
      setNumber: true,
      repsCompleted: true,
      weightKg: true,
      exercise: { select: { name: true, nameEn: true } },
    },
  },
} satisfies Prisma.WorkoutLogSelect;

@Injectable()
export class CoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly workouts: WorkoutsService,
    private readonly programs: ProgramsService,
    private readonly mail: MailService,
  ) {}

  async assignProgram(
    userId: string,
    templateId: string,
  ): Promise<CoachClientDetail> {
    const result = await this.programs.assignTemplate(userId, templateId);
    if (result.notice) {
      void this.mail.sendProgramAssigned(result.notice);
    }
    return this.getClient(userId);
  }

  async archiveClient(userId: string): Promise<{ id: string }> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const client = await tx.user.findFirst({
        where: { id: userId, role: UserRole.CLIENT },
        select: { id: true, isActive: true },
      });
      if (!client) {
        throw new NotFoundException({
          code: 'CLIENT_NOT_FOUND',
          message: 'Client not found.',
        });
      }
      if (client.isActive) {
        await tx.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
      }
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.authRefreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    return { id: userId };
  }

  async restoreClient(userId: string): Promise<{ id: string }> {
    await this.prisma.$transaction(async (tx) => {
      const client = await tx.user.findFirst({
        where: { id: userId, role: UserRole.CLIENT },
        select: { id: true, isActive: true },
      });
      if (!client) {
        throw new NotFoundException({
          code: 'CLIENT_NOT_FOUND',
          message: 'Client not found.',
        });
      }
      if (!client.isActive) {
        await tx.user.update({
          where: { id: userId },
          data: { isActive: true },
        });
      }
    });
    return { id: userId };
  }

  async listClients(): Promise<CoachClientsResponse> {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: { role: UserRole.CLIENT },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        profile: { select: { name: true, onboardingCompletedAt: true } },
        workoutProgram: { select: { template: { select: { name: true } } } },
        subscriptions: {
          select: { status: true, currentPeriodEnd: true },
        },
      },
    });
    const lastWorkoutAt = await this.latestWorkouts(
      users.map((user) => user.id),
    );

    return {
      clients: users.map((user) =>
        toSummary(user, lastWorkoutAt.get(user.id) ?? null, now),
      ),
    };
  }

  async listProgramClients(
    templateId: string,
  ): Promise<CoachProgramClientsResponse> {
    const template = await this.prisma.programTemplate.findUnique({
      where: { id: templateId },
      select: { name: true },
    });
    if (!template) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Program not found.',
      });
    }
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.CLIENT,
        workoutProgram: { templateId },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        profile: { select: { name: true, onboardingCompletedAt: true } },
        workoutProgram: { select: { template: { select: { name: true } } } },
        subscriptions: {
          select: { status: true, currentPeriodEnd: true },
        },
      },
    });
    const lastWorkoutAt = await this.latestWorkouts(
      users.map((user) => user.id),
    );
    return {
      programName: template.name,
      clients: users.map((user) =>
        toSummary(user, lastWorkoutAt.get(user.id) ?? null, now),
      ),
    };
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

  async updateNote(
    userId: string,
    input: UpdateCoachNoteInput,
  ): Promise<CoachClientDetail> {
    const base = input.base.length === 0 ? null : input.base;
    const note = input.note.length === 0 ? null : input.note;
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, role: UserRole.CLIENT, coachNote: base },
      data: { coachNote: note },
    });
    if (updated.count === 1) return this.getClient(userId);
    await this.requireClient(userId);
    throw new ConflictException({
      code: 'NOTE_CONFLICT',
      message: 'A newer note was saved.',
    });
  }

  async listWorkouts(
    userId: string,
    query: ListWorkoutLogsQuery,
  ): Promise<CoachClientWorkoutsResponse> {
    await this.requireClient(userId);
    const where = { userId };
    const [logs, total] = await Promise.all([
      this.prisma.workoutLog.findMany({
        where,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
        select: workoutHistorySelect,
      }),
      this.prisma.workoutLog.count({ where }),
    ]);
    return { logs: logs.map(toWorkoutHistory), total };
  }

  async listMeasurements(userId: string): Promise<WeightMeasurementsResponse> {
    await this.requireClient(userId);
    return this.users.listMeasurements(userId);
  }

  async listStrength(userId: string): Promise<StrengthChangesResponse> {
    await this.requireClient(userId);
    return this.workouts.strength(userId);
  }

  async listProgressPhotos(userId: string): Promise<ProgressPhotosResponse> {
    await this.requireClient(userId);
    return this.users.listProgressPhotos(userId);
  }

  async readProgressPhoto(userId: string, photoId: string): Promise<Buffer> {
    await this.requireClient(userId);
    return this.users.readProgressPhoto(userId, photoId);
  }

  private async latestWorkouts(userIds: string[]): Promise<Map<string, Date>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.workoutLog.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _max: { completedAt: true },
    });
    const latest = new Map<string, Date>();
    for (const row of rows) {
      if (row._max.completedAt) latest.set(row.userId, row._max.completedAt);
    }
    return latest;
  }

  private async requireClient(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.CLIENT },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'CLIENT_NOT_FOUND',
        message: 'Client not found.',
      });
    }
  }
}

function toSummary(
  user: {
    id: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
    profile: { name: string | null; onboardingCompletedAt: Date | null } | null;
    workoutProgram: { template: { name: string } } | null;
    subscriptions: {
      status: SubscriptionStatus;
      currentPeriodEnd: Date | null;
    }[];
  },
  lastWorkoutAt: Date | null,
  now: Date,
): CoachClientSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.profile?.name ?? null,
    createdAt: user.createdAt.toISOString(),
    onboardingCompleted: user.profile?.onboardingCompletedAt != null,
    programAssigned: user.workoutProgram != null,
    programName: user.workoutProgram?.template.name ?? null,
    lastWorkoutAt: lastWorkoutAt?.toISOString() ?? null,
    archived: user.isActive === false,
    subscriptionOnFile: user.subscriptions.length > 0,
    subscriptionActive: user.subscriptions.some((subscription) =>
      grantsActiveAccess(subscription, now),
    ),
    accessExpired: accessHasExpired(user.subscriptions, now),
  };
}

function accessHasExpired(
  subscriptions: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
  }[],
  now: Date,
): boolean {
  if (
    subscriptions.some((subscription) => grantsActiveAccess(subscription, now))
  ) {
    return false;
  }
  return subscriptions.some((subscription) => {
    if (subscription.status === SubscriptionStatus.EXPIRED) return true;
    if (subscription.status !== SubscriptionStatus.ACTIVE) return false;
    return (
      subscription.currentPeriodEnd != null &&
      subscription.currentPeriodEnd <= now
    );
  });
}

type ClientDetailRow = Prisma.UserGetPayload<{
  select: typeof clientDetailSelect;
}>;

type WorkoutHistoryRow = Prisma.WorkoutLogGetPayload<{
  select: typeof workoutHistorySelect;
}>;

function toWorkoutHistory(log: WorkoutHistoryRow): CoachClientWorkoutLog {
  return {
    id: log.id,
    completedAt: log.completedAt.toISOString(),
    dayNumber: log.dayNumber,
    templateCode: log.template?.code ?? log.templateCode ?? '',
    templateName: log.template?.name ?? log.templateName ?? '',
    sets: log.sets.map((set) => ({
      order: set.order,
      setNumber: set.setNumber,
      repsCompleted: set.repsCompleted,
      weightKg: set.weightKg?.toNumber() ?? null,
      exercise: { name: set.exercise.name, nameEn: set.exercise.nameEn },
    })),
  };
}

// Prefer a row that still grants access. Otherwise show the newest row.
function shownSubscription<
  T extends { status: SubscriptionStatus; currentPeriodEnd: Date | null },
>(rows: T[], now: Date): T | null {
  return rows.find((row) => grantsActiveAccess(row, now)) ?? rows[0] ?? null;
}

function toDetail(user: ClientDetailRow, now: Date): CoachClientDetail {
  const subscription = shownSubscription(user.subscriptions, now);
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
    archived: user.isActive === false,
    note: user.coachNote ?? '',
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
            origin: template.origin,
            assignmentSource: user.workoutProgram.assignmentSource,
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
