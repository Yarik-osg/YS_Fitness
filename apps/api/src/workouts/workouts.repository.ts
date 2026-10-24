import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StrengthChange } from '@repo/shared-types';
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

export type LockedTemplateDay = {
  dayNumber: number;
  exercises: { exerciseId: string; order: number; sets: number }[];
};

type Client = Prisma.TransactionClient;

@Injectable()
export class WorkoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async lockTemplateDays(
    templateId: string,
    client: Client,
  ): Promise<LockedTemplateDay[] | null> {
    const locked = await client.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM program_templates
      WHERE id = CAST(${templateId} AS uuid)
      FOR UPDATE
    `;
    if (!locked[0]) return null;
    const template = await client.programTemplate.findUnique({
      where: { id: templateId },
      select: {
        days: {
          select: {
            dayNumber: true,
            exercises: {
              select: { exerciseId: true, order: true, sets: true },
            },
          },
        },
      },
    });
    return template?.days ?? null;
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

  /** Earliest and latest loaded weight per exercise, across the whole history. */
  strengthChanges(userId: string): Promise<StrengthChange[]> {
    return this.prisma.$queryRaw<StrengthChange[]>`
      WITH best AS (
        SELECT
          l.id AS log_id,
          l.completed_at,
          s.exercise_id,
          MAX(s.weight_kg) AS kg
        FROM workout_logs l
        INNER JOIN workout_log_sets s ON s.workout_log_id = l.id
        WHERE l.user_id = CAST(${userId} AS uuid)
          AND s.weight_kg IS NOT NULL
          AND s.weight_kg > 0
        GROUP BY l.id, l.completed_at, s.exercise_id
      ),
      earliest AS (
        SELECT DISTINCT ON (exercise_id)
          exercise_id, log_id, kg
        FROM best
        ORDER BY exercise_id, completed_at ASC, log_id::text ASC
      ),
      latest AS (
        SELECT DISTINCT ON (exercise_id)
          exercise_id, log_id, kg
        FROM best
        ORDER BY exercise_id, completed_at DESC, log_id::text DESC
      )
      SELECT
        earliest.exercise_id::text AS "exerciseId",
        exercise.name AS name,
        exercise.name_en AS "nameEn",
        earliest.kg::float8 AS "fromKg",
        latest.kg::float8 AS "toKg"
      FROM earliest
      INNER JOIN latest ON latest.exercise_id = earliest.exercise_id
      INNER JOIN exercises exercise ON exercise.id = earliest.exercise_id
      WHERE earliest.log_id <> latest.log_id
        AND earliest.kg <> latest.kg
      ORDER BY (latest.kg - earliest.kg) DESC, earliest.exercise_id::text ASC
    `;
  }
}
