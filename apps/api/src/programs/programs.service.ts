import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AssignedProgramLookupResponse,
  AssignedProgramResponse,
  AssignedProgramSummary,
  CurrentProgramResponse,
  ExerciseResponse,
  ProgramAccent,
  TrainingExperience,
} from '@repo/shared-types';
import type { ListExercisesQuery } from '@repo/validation';
import type { MuscleGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { matchProgramTemplate } from './match-template.js';
import { expectedProgramSessions, nextProgramDay } from './program-cycle.js';

const PROGRAM_NOT_AVAILABLE = {
  code: 'PROGRAM_NOT_AVAILABLE',
  message: 'No program is available for this track yet',
};

const programInclude = {
  template: {
    include: {
      days: {
        orderBy: { dayNumber: 'asc' as const },
        include: {
          exercises: {
            orderBy: { order: 'asc' as const },
            include: { exercise: true },
          },
        },
      },
    },
  },
} satisfies Prisma.WorkoutProgramInclude;

type ProgramRecord = Prisma.WorkoutProgramGetPayload<{
  include: typeof programInclude;
}>;

type ProgramStore = Pick<
  Prisma.TransactionClient,
  'onboardingResponses' | 'programTemplate' | 'workoutProgram'
>;

type AssignedProgramBase = Omit<
  AssignedProgramSummary,
  'nextDayNumber' | 'programProgress' | 'dayLogCounts'
>;

type AssignedProgramRecord = AssignedProgramBase & {
  days: AssignedProgramResponse['days'];
};

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(
    userId: string,
    db: ProgramStore = this.prisma,
    options?: { preserveAssignedAt?: boolean },
  ): Promise<AssignedProgramResponse> {
    const responses = await db.onboardingResponses.findUnique({
      where: { userId },
    });
    if (!responses) {
      throw new NotFoundException(PROGRAM_NOT_AVAILABLE);
    }

    const match = matchProgramTemplate({
      programTrack: responses.programTrack === 'MALE' ? 'male' : 'female',
      experience: responses.experience.toLowerCase(),
      trainingFrequency: responses.trainingFrequency,
      focusArea: responses.focusAreas[0],
    });
    if (!match) throw new NotFoundException(PROGRAM_NOT_AVAILABLE);

    const template = await db.programTemplate.findFirst({
      where: { ...match, active: true },
    });
    if (!template) throw new NotFoundException(PROGRAM_NOT_AVAILABLE);

    if (options?.preserveAssignedAt) {
      const existing = await db.workoutProgram.findUnique({
        where: { userId },
        select: { templateId: true },
      });
      if (existing?.templateId === template.id) {
        const current = await db.workoutProgram.findUnique({
          where: { userId },
          include: programInclude,
        });
        if (!current) throw new NotFoundException(PROGRAM_NOT_AVAILABLE);
        return this.withProgramCycle(userId, toAssignedProgram(current));
      }
    }

    const program = await db.workoutProgram.upsert({
      where: { userId },
      create: { userId, templateId: template.id },
      update: { templateId: template.id, assignedAt: new Date() },
      include: programInclude,
    });

    return this.withProgramCycle(userId, toAssignedProgram(program));
  }

  async getAssignedProgram(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<{ program: AssignedProgramRecord | null }> {
    return { program: await this.loadProgram(userId, db) };
  }

  async getMine(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<CurrentProgramResponse> {
    const program = await this.loadProgram(userId, db);
    if (!program) return { program: null };
    return { program: await this.withProgramCycle(userId, program) };
  }

  async getAssigned(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<AssignedProgramLookupResponse> {
    const program = await db.workoutProgram.findUnique({
      where: { userId },
      include: { template: true },
    });
    if (!program) return { program: null };
    return {
      program: await this.withProgramCycle(userId, toAssignedSummary(program)),
    };
  }

  async unassign(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<void> {
    await db.workoutProgram.deleteMany({ where: { userId } });
  }

  async listExercises(query: ListExercisesQuery): Promise<ExerciseResponse[]> {
    const exercises = await this.prisma.exercise.findMany({
      where: query.muscleGroup
        ? { muscleGroups: { has: query.muscleGroup as MuscleGroup } }
        : undefined,
      orderBy: { code: 'asc' },
    });

    return exercises.map((exercise) => ({
      id: exercise.id,
      code: exercise.code,
      name: exercise.name,
      muscleGroups: exercise.muscleGroups,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
    }));
  }

  private async loadProgram(
    userId: string,
    db: ProgramStore,
  ): Promise<AssignedProgramRecord | null> {
    const program = await db.workoutProgram.findUnique({
      where: { userId },
      include: programInclude,
    });
    return program ? toAssignedProgram(program) : null;
  }

  private async withProgramCycle<T extends AssignedProgramBase>(
    userId: string,
    program: T,
  ): Promise<
    T &
      Pick<
        AssignedProgramSummary,
        'nextDayNumber' | 'programProgress' | 'dayLogCounts'
      >
  > {
    const assignedAt = new Date(program.assignedAt);
    const loggedSinceAssignment = {
      userId,
      templateId: program.templateId,
      completedAt: { gte: assignedAt },
    };
    // Read logs here so program lookup does not depend on WorkoutsService.
    const [latest, groups] = await Promise.all([
      this.prisma.workoutLog.findFirst({
        where: { userId, templateId: program.templateId },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: { dayNumber: true },
      }),
      this.prisma.workoutLog.groupBy({
        by: ['dayNumber'],
        where: loggedSinceAssignment,
        _count: { _all: true },
      }),
    ]);
    const dayLogCounts = groups
      .map((group) => ({
        dayNumber: group.dayNumber,
        count: group._count._all,
      }))
      .sort((left, right) => left.dayNumber - right.dayNumber);

    return {
      ...program,
      nextDayNumber: nextProgramDay(
        latest?.dayNumber ?? null,
        program.frequencyPerWeek,
      ),
      programProgress: {
        completed: dayLogCounts.reduce((sum, day) => sum + day.count, 0),
        expected: expectedProgramSessions(program.frequencyPerWeek),
      },
      dayLogCounts,
    };
  }
}

export function toProgramSummary(
  program: AssignedProgramResponse,
): AssignedProgramSummary {
  return {
    id: program.id,
    templateId: program.templateId,
    templateCode: program.templateCode,
    templateName: program.templateName,
    gender: program.gender,
    level: program.level,
    frequencyPerWeek: program.frequencyPerWeek,
    accent: program.accent,
    assignedAt: program.assignedAt,
    nextDayNumber: program.nextDayNumber,
    programProgress: program.programProgress,
    dayLogCounts: program.dayLogCounts,
  };
}

function toAssignedSummary(program: {
  id: string;
  assignedAt: Date;
  template: {
    id: string;
    code: string;
    name: string;
    gender: string;
    level: string;
    frequencyPerWeek: number;
    accent: string;
  };
}): AssignedProgramBase {
  return {
    id: program.id,
    templateId: program.template.id,
    templateCode: program.template.code,
    templateName: program.template.name,
    gender: program.template.gender === 'MALE' ? 'male' : 'female',
    level: program.template.level.toLowerCase() as TrainingExperience,
    frequencyPerWeek: program.template.frequencyPerWeek,
    accent: program.template.accent as ProgramAccent,
    assignedAt: program.assignedAt.toISOString(),
  };
}

function toAssignedProgram(program: ProgramRecord): AssignedProgramRecord {
  return {
    ...toAssignedSummary(program),
    days: program.template.days.map((day) => ({
      dayNumber: day.dayNumber,
      exercises: day.exercises.map((row) => ({
        order: row.order,
        sets: row.sets,
        allowsAbsAddon: row.allowsAbsAddon,
        exercise: {
          id: row.exercise.id,
          code: row.exercise.code,
          name: row.exercise.name,
          muscleGroups: row.exercise.muscleGroups,
          repsMin: row.exercise.repsMin,
          repsMax: row.exercise.repsMax,
        },
      })),
    })),
  };
}
