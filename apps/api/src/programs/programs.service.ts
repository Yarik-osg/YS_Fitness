import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssignedProgramLookupResponse,
  AssignedProgramResponse,
  AssignedProgramSummary,
  CurrentProgramResponse,
  ExerciseResponse,
  ProgramAccent,
  ProgramPromotion,
  ProgramPromotionSuggestion,
  TrainingExperience,
} from '@repo/shared-types';
import type { ListExercisesQuery } from '@repo/validation';
import {
  Prisma,
  type MuscleGroup,
  type ProgramAccent as Accent,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { focusAreaForAccent, matchProgramTemplate } from './match-template.js';
import { expectedProgramSessions, nextProgramDay } from './program-cycle.js';

const PROGRAM_NOT_AVAILABLE = {
  code: 'PROGRAM_NOT_AVAILABLE',
  message: 'No program is available for this track yet',
};

const PROMOTION_NOT_AVAILABLE = {
  code: 'PROMOTION_NOT_AVAILABLE',
  message: 'This program is no longer available to start',
};

const STORED_EXPERIENCE = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
} as const satisfies Record<TrainingExperience, string>;

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
  'onboardingResponses' | 'programTemplate' | 'workoutProgram' | 'workoutLog'
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
        return this.withProgramCycle(userId, toAssignedProgram(current), db);
      }
    }

    const program = await db.workoutProgram.upsert({
      where: { userId },
      create: { userId, templateId: template.id },
      update: { templateId: template.id, assignedAt: new Date() },
      include: programInclude,
    });

    return this.withProgramCycle(userId, toAssignedProgram(program), db);
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
    return { program: await this.withProgramCycle(userId, program, db) };
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
      program: await this.withProgramCycle(
        userId,
        toAssignedSummary(program),
        db,
      ),
    };
  }

  async getPromotion(userId: string): Promise<ProgramPromotion | null> {
    return this.promotionFor(userId, this.prisma);
  }

  async acceptPromotion(
    userId: string,
    templateId: string,
  ): Promise<AssignedProgramResponse> {
    try {
      return await this.acceptPromotionOnce(userId, templateId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        return this.acceptPromotionOnce(userId, templateId);
      }
      throw error;
    }
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
      nameEn: exercise.nameEn,
      muscleGroups: exercise.muscleGroups,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
    }));
  }

  private acceptPromotionOnce(
    userId: string,
    templateId: string,
  ): Promise<AssignedProgramResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        const promotion = await this.promotionFor(userId, tx);
        const suggestion = promotion?.suggestions.find(
          (item) => item.id === templateId,
        );
        if (!promotion || !suggestion) {
          throw new BadRequestException(PROMOTION_NOT_AVAILABLE);
        }

        const responses = await tx.onboardingResponses.findUnique({
          where: { userId },
        });
        if (!responses) {
          throw new BadRequestException(PROMOTION_NOT_AVAILABLE);
        }

        const track = responses.programTrack === 'MALE' ? 'male' : 'female';
        const current = matchProgramTemplate({
          programTrack: track,
          experience: responses.experience.toLowerCase(),
          trainingFrequency: responses.trainingFrequency,
          focusArea: responses.focusAreas[0],
        });
        const keepFocus =
          promotion.kind === 'level-up' &&
          current?.accent === suggestion.accent &&
          responses.focusAreas[0] !== undefined;
        const focus = keepFocus
          ? responses.focusAreas[0]
          : focusAreaForAccent(track, suggestion.accent as Accent);
        if (!focus) throw new BadRequestException(PROMOTION_NOT_AVAILABLE);

        await tx.onboardingResponses.update({
          where: { userId },
          data: {
            experience: STORED_EXPERIENCE[suggestion.level],
            focusAreas: [focus],
          },
        });

        const assigned = await this.assign(userId, tx);
        if (assigned.templateId !== templateId) {
          throw new BadRequestException(PROMOTION_NOT_AVAILABLE);
        }
        return assigned;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async promotionFor(
    userId: string,
    db: ProgramStore,
  ): Promise<ProgramPromotion | null> {
    const { program } = await this.getMine(userId, db);
    if (
      !program ||
      program.programProgress.completed < program.programProgress.expected
    ) {
      return null;
    }

    const track = program.gender;
    const gender = track === 'male' ? 'MALE' : 'FEMALE';
    const fromLevel = program.level;
    const toLevel: TrainingExperience =
      fromLevel === 'beginner' ? 'intermediate' : 'advanced';
    const kind = fromLevel === 'advanced' ? 'zone-change' : 'level-up';

    if (kind === 'level-up') {
      const template = await db.programTemplate.findFirst({
        where: {
          gender,
          level: STORED_EXPERIENCE[toLevel],
          frequencyPerWeek: program.frequencyPerWeek,
          accent: program.accent as Accent,
          active: true,
        },
      });
      const suggestions =
        template && focusAreaForAccent(track, template.accent)
          ? [toSuggestion(template)]
          : [];
      return { kind, fromLevel, toLevel, suggestions };
    }

    const templates = await db.programTemplate.findMany({
      where: {
        gender,
        level: 'ADVANCED',
        frequencyPerWeek: program.frequencyPerWeek,
        accent: { not: program.accent as Accent },
        active: true,
      },
      orderBy: { code: 'asc' },
    });
    return {
      kind,
      fromLevel,
      toLevel,
      suggestions: templates
        .filter((template) => focusAreaForAccent(track, template.accent))
        .map((template) => toSuggestion(template)),
    };
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
    db: ProgramStore = this.prisma,
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
    // Count on the caller's store so an open transaction uses its own snapshot.
    const [latest, groups] = await Promise.all([
      db.workoutLog.findFirst({
        where: loggedSinceAssignment,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: { dayNumber: true },
      }),
      db.workoutLog.groupBy({
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

function toSuggestion(template: {
  id: string;
  code: string;
  name: string;
  accent: Accent;
  level: string;
  frequencyPerWeek: number;
}): ProgramPromotionSuggestion {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    accent: template.accent,
    level: template.level.toLowerCase() as TrainingExperience,
    frequencyPerWeek: template.frequencyPerWeek,
  };
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
          nameEn: row.exercise.nameEn,
          muscleGroups: row.exercise.muscleGroups,
          repsMin: row.repsMin,
          repsMax: row.repsMax,
        },
      })),
    })),
  };
}
