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
        return toAssignedProgram(current);
      }
    }

    const program = await db.workoutProgram.upsert({
      where: { userId },
      create: { userId, templateId: template.id },
      update: { templateId: template.id, assignedAt: new Date() },
      include: programInclude,
    });

    return toAssignedProgram(program);
  }

  async getMine(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<CurrentProgramResponse> {
    const program = await db.workoutProgram.findUnique({
      where: { userId },
      include: programInclude,
    });
    return { program: program ? toAssignedProgram(program) : null };
  }

  async getAssigned(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<AssignedProgramLookupResponse> {
    const program = await db.workoutProgram.findUnique({
      where: { userId },
      include: { template: true },
    });
    return { program: program ? toAssignedSummary(program) : null };
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
}

export function toProgramSummary(
  program: AssignedProgramResponse,
): AssignedProgramSummary {
  return {
    id: program.id,
    templateCode: program.templateCode,
    templateName: program.templateName,
    gender: program.gender,
    level: program.level,
    frequencyPerWeek: program.frequencyPerWeek,
    accent: program.accent,
    assignedAt: program.assignedAt,
  };
}

function toAssignedSummary(program: {
  id: string;
  assignedAt: Date;
  template: {
    code: string;
    name: string;
    gender: string;
    level: string;
    frequencyPerWeek: number;
    accent: string;
  };
}): AssignedProgramSummary {
  return {
    id: program.id,
    templateCode: program.template.code,
    templateName: program.template.name,
    gender: program.template.gender === 'MALE' ? 'male' : 'female',
    level: program.template.level.toLowerCase() as TrainingExperience,
    frequencyPerWeek: program.template.frequencyPerWeek,
    accent: program.template.accent as ProgramAccent,
    assignedAt: program.assignedAt.toISOString(),
  };
}

function toAssignedProgram(program: ProgramRecord): AssignedProgramResponse {
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
