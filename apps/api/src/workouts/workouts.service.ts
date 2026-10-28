import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isDayOpenInCycle,
  type StrengthChangesResponse,
  type WorkoutCalendarResponse,
  type WorkoutLogListResponse,
  type WorkoutLogResponse,
} from '@repo/shared-types';
import type {
  ListWorkoutLogsQuery,
  LogWorkoutInput,
  WorkoutCalendarQuery,
} from '@repo/validation';
import { ProgramsService } from '../programs/programs.service.js';
import { weightRecommendation } from './weight-recommendation.js';
import {
  WorkoutsRepository,
  type LockedTemplateDay,
  type WorkoutLogRecord,
} from './workouts.repository.js';

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly workouts: WorkoutsRepository,
    private readonly programs: ProgramsService,
  ) {}

  async log(
    userId: string,
    input: LogWorkoutInput,
  ): Promise<WorkoutLogResponse> {
    const { program } = await this.programs.getAssignedProgram(userId);
    if (!program) {
      throw new ConflictException({
        code: 'PROGRAM_NOT_ASSIGNED',
        message: 'No program is assigned',
      });
    }
    if (program.templateId !== input.templateId) {
      throw new ConflictException({
        code: 'TEMPLATE_NOT_ASSIGNED',
        message: 'This template is not the assigned program',
      });
    }
    assertDayOpen(program, input.dayNumber);

    assertPrescribedSets(
      program.days.map((day) => ({
        dayNumber: day.dayNumber,
        exercises: day.exercises.map((row) => ({
          exerciseId: row.exercise.id,
          order: row.order,
          sets: row.sets,
        })),
      })),
      input,
    );

    const created = await this.workouts.transaction(async (transaction) => {
      // The template row lock makes a second save wait until this one
      // commits, so the cycle read below sees it. The assignment advisory
      // lock is a different key and is not taken on this path.
      const days = await this.workouts.lockTemplateDays(
        input.templateId,
        transaction,
      );
      if (!days) {
        throw new NotFoundException({
          code: 'PROGRAM_DAY_NOT_FOUND',
          message: 'That day is not on the assigned program',
        });
      }
      const { program: current } = await this.programs.getAssignedProgram(
        userId,
        transaction,
      );
      if (!current) {
        throw new ConflictException({
          code: 'PROGRAM_NOT_ASSIGNED',
          message: 'No program is assigned',
        });
      }
      if (current.templateId !== input.templateId) {
        throw new ConflictException({
          code: 'TEMPLATE_NOT_ASSIGNED',
          message: 'This template is not the assigned program',
        });
      }
      assertDayOpen(current, input.dayNumber);
      assertPrescribedSets(days, input);
      return this.workouts.create(userId, input, transaction);
    });
    return toWorkoutLog(created);
  }

  async list(
    userId: string,
    query: ListWorkoutLogsQuery,
  ): Promise<WorkoutLogListResponse> {
    const [logs, total] = await Promise.all([
      this.workouts.list(userId, query),
      this.workouts.count(userId),
    ]);
    return { logs: logs.map(toWorkoutLog), total };
  }

  async strength(userId: string): Promise<StrengthChangesResponse> {
    const changes = await this.workouts.strengthChanges(userId);
    return {
      changes: changes.map((change) => ({
        ...change,
        fromKg: Number(change.fromKg),
        toKg: Number(change.toKg),
      })),
    };
  }

  async calendar(
    userId: string,
    query: WorkoutCalendarQuery,
  ): Promise<WorkoutCalendarResponse> {
    const logs = await this.workouts.listBetween(
      userId,
      new Date(query.from),
      new Date(query.to),
    );
    return { logs: logs.map(toWorkoutLog) };
  }
}

function assertPrescribedSets(
  days: LockedTemplateDay[],
  input: LogWorkoutInput,
): void {
  const day = days.find((entry) => entry.dayNumber === input.dayNumber);
  if (!day) {
    throw new NotFoundException({
      code: 'PROGRAM_DAY_NOT_FOUND',
      message: 'That day is not on the assigned program',
    });
  }

  const prescribedSets = new Map(
    day.exercises.map((row) => [`${row.exerciseId}:${row.order}`, row.sets]),
  );
  const seenSets = new Set<string>();
  for (const set of input.sets) {
    const row = `${set.exerciseId}:${set.order}`;
    const sets = prescribedSets.get(row);
    if (sets === undefined) {
      throw new BadRequestException({
        code: 'EXERCISE_NOT_ON_DAY',
        message: 'A logged exercise is not on this program day',
      });
    }
    if (set.setNumber > sets) {
      throw new BadRequestException({
        code: 'SET_NUMBER_OUT_OF_RANGE',
        message: 'A logged set number exceeds the prescribed sets',
      });
    }
    const key = `${row}:${set.setNumber}`;
    if (seenSets.has(key)) {
      throw new BadRequestException({
        code: 'DUPLICATE_SET',
        message: 'A set was logged more than once',
      });
    }
    seenSets.add(key);
  }
}

function toWorkoutLog(log: WorkoutLogRecord): WorkoutLogResponse {
  const lastSetNumber = new Map<string, number>();
  for (const set of log.sets) {
    const current = lastSetNumber.get(set.exerciseId) ?? 0;
    if (set.setNumber > current) {
      lastSetNumber.set(set.exerciseId, set.setNumber);
    }
  }

  return {
    id: log.id,
    userId: log.userId,
    templateId: log.templateId,
    dayNumber: log.dayNumber,
    completedAt: log.completedAt.toISOString(),
    sets: log.sets.map((set) => {
      const prescribed = prescribedReps(log, set.order, set.exerciseId);
      const repsMin = prescribed?.repsMin ?? set.exercise.repsMin;
      const repsMax = prescribed?.repsMax ?? set.exercise.repsMax;
      return {
        id: set.id,
        exerciseId: set.exerciseId,
        order: set.order,
        setNumber: set.setNumber,
        repsCompleted: set.repsCompleted,
        weightKg: set.weightKg?.toNumber() ?? null,
        recommendation:
          set.setNumber === lastSetNumber.get(set.exerciseId)
            ? weightRecommendation(set.repsCompleted, repsMin, repsMax)
            : null,
        exercise: {
          id: set.exercise.id,
          code: set.exercise.code,
          name: set.exercise.name,
          nameEn: set.exercise.nameEn,
          muscleGroups: set.exercise.muscleGroups,
          repsMin,
          repsMax,
        },
      };
    }),
  };
}

function assertDayOpen(
  program: {
    frequencyPerWeek: number;
    dayLogCounts: readonly { dayNumber: number; count: number }[];
  },
  dayNumber: number,
): void {
  if (
    dayNumber <= program.frequencyPerWeek &&
    !isDayOpenInCycle(dayNumber, program.dayLogCounts, program.frequencyPerWeek)
  ) {
    throw new ConflictException({
      code: 'PROGRAM_DAY_COMPLETED',
      message: 'That workout is already done for this cycle',
    });
  }
}

function prescribedReps(
  log: WorkoutLogRecord,
  order: number,
  exerciseId: string,
) {
  const day = log.template.days.find(
    (entry) => entry.dayNumber === log.dayNumber,
  );
  if (!day) return undefined;
  const exact = day.exercises.find(
    (entry) => entry.order === order && entry.exerciseId === exerciseId,
  );
  if (exact) return exact;
  // Same exercise can sit on several orders. The logged order moved, so use the lowest remaining order on this day.
  return day.exercises
    .filter((entry) => entry.exerciseId === exerciseId)
    .sort((left, right) => left.order - right.order)[0];
}
