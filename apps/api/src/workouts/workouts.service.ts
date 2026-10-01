import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  WorkoutLogListResponse,
  WorkoutLogResponse,
} from '@repo/shared-types';
import type { ListWorkoutLogsQuery, LogWorkoutInput } from '@repo/validation';
import { ProgramsService } from '../programs/programs.service.js';
import {
  WorkoutsRepository,
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
    const { program } = await this.programs.getMine(userId);
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

    const day = program.days.find(
      (entry) => entry.dayNumber === input.dayNumber,
    );
    if (!day) {
      throw new NotFoundException({
        code: 'PROGRAM_DAY_NOT_FOUND',
        message: 'That day is not on the assigned program',
      });
    }

    const exerciseIds = new Set(day.exercises.map((row) => row.exercise.id));
    if (input.sets.some((set) => !exerciseIds.has(set.exerciseId))) {
      throw new BadRequestException({
        code: 'EXERCISE_NOT_ON_DAY',
        message: 'A logged exercise is not on this program day',
      });
    }

    const created = await this.workouts.transaction((transaction) =>
      this.workouts.create(userId, input, transaction),
    );
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
}

function toWorkoutLog(log: WorkoutLogRecord): WorkoutLogResponse {
  return {
    id: log.id,
    userId: log.userId,
    templateId: log.templateId,
    dayNumber: log.dayNumber,
    completedAt: log.completedAt.toISOString(),
    sets: log.sets.map((set) => ({
      id: set.id,
      exerciseId: set.exerciseId,
      order: set.order,
      setNumber: set.setNumber,
      repsCompleted: set.repsCompleted,
      weightKg: set.weightKg?.toNumber() ?? null,
      exercise: {
        id: set.exercise.id,
        code: set.exercise.code,
        name: set.exercise.name,
        muscleGroups: set.exercise.muscleGroups,
        repsMin: set.exercise.repsMin,
        repsMax: set.exercise.repsMax,
      },
    })),
  };
}
