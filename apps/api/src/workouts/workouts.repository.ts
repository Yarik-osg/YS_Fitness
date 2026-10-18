import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ListWorkoutLogsQuery, LogWorkoutInput } from '@repo/validation';
import { PrismaService } from '../prisma/prisma.service.js';

const logWithSets = {
  include: {
    template: {
      select: {
        days: {
          select: {
            dayNumber: true,
            exercises: {
              select: {
                order: true,
                exerciseId: true,
                repsMin: true,
                repsMax: true,
              },
            },
          },
        },
      },
    },
    sets: {
      orderBy: [{ order: 'asc' as const }, { setNumber: 'asc' as const }],
      include: { exercise: true },
    },
  },
} satisfies Prisma.WorkoutLogDefaultArgs;

export type WorkoutLogRecord = Prisma.WorkoutLogGetPayload<typeof logWithSets>;

type Client = Prisma.TransactionClient;

@Injectable()
export class WorkoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  create(
    userId: string,
    input: LogWorkoutInput,
    client: Client = this.prisma,
  ): Promise<WorkoutLogRecord> {
    return client.workoutLog.create({
      data: {
        userId,
        templateId: input.templateId,
        dayNumber: input.dayNumber,
        sets: {
          create: input.sets.map((set) => ({
            exerciseId: set.exerciseId,
            order: set.order,
            setNumber: set.setNumber,
            repsCompleted: set.repsCompleted,
            weightKg: set.weightKg ?? null,
          })),
        },
      },
      ...logWithSets,
    });
  }

  list(
    userId: string,
    query: ListWorkoutLogsQuery,
  ): Promise<WorkoutLogRecord[]> {
    return this.prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      skip: query.offset,
      take: query.limit,
      ...logWithSets,
    });
  }

  /** Logs completed in [from, to), oldest first. */
  listBetween(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<WorkoutLogRecord[]> {
    return this.prisma.workoutLog.findMany({
      where: { userId, completedAt: { gte: from, lt: to } },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
      ...logWithSets,
    });
  }

  count(userId: string): Promise<number> {
    return this.prisma.workoutLog.count({ where: { userId } });
  }
}
