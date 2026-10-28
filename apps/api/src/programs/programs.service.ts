import {
  BadRequestException,
  ConflictException,
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

const TRAINER_PROGRAM_ASSIGNED = {
  code: 'TRAINER_PROGRAM_ASSIGNED',
  message: 'A trainer program is already assigned',
};

const ADMIN_PROGRAM_ASSIGNED = {
  code: 'ADMIN_PROGRAM_ASSIGNED',
  message: 'An admin-assigned program cannot be replaced this way',
};

const CLIENT_NOT_FOUND = {
  code: 'CLIENT_NOT_FOUND',
  message: 'Client not found.',
};

const TEMPLATE_NOT_FOUND = {
  code: 'TEMPLATE_NOT_FOUND',
  message: 'Program template not found',
};

const TEMPLATE_INACTIVE = {
  code: 'TEMPLATE_INACTIVE',
  message: 'This program is not available to assign',
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
  | '$executeRaw'
  | '$queryRaw'
  | 'onboardingResponses'
  | 'programTemplate'
  | 'workoutProgram'
  | 'workoutLog'
  | 'user'
>;

type AssignOptions = {
  preserveAssignedAt?: boolean;
  onTrainerProgram?: 'keep' | 'reject';
};

type AssignmentLock = {
  origin: 'SYSTEM' | 'TRAINER';
  templateId: string;
  assignmentSource: 'MATCHED' | 'ADMIN';
};

export type TemplateAssignmentChange = 'assigned' | 'replaced' | 'unchanged';

export type TemplateAssignmentNotice = {
  to: string;
  kind: 'assigned' | 'updated';
  name: string;
  origin: 'SYSTEM' | 'TRAINER';
  frequencyPerWeek: number;
  days: { exercises: { name: string; nameEn: string }[] }[];
};

export type TemplateAssignmentResult = {
  program: AssignedProgramResponse;
  change: TemplateAssignmentChange;
  notice: TemplateAssignmentNotice | null;
};

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
    options?: AssignOptions,
  ): Promise<AssignedProgramResponse> {
    const resolved: AssignOptions = {
      ...options,
      onTrainerProgram: options?.onTrainerProgram ?? 'reject',
    };
    if (db !== this.prisma) {
      return this.assignLocked(userId, db, resolved);
    }

    try {
      return await this.prisma.$transaction((tx) =>
        this.assignLocked(userId, tx, resolved),
      );
    } catch (error) {
      // Only the transaction opened here can be abandoned. Profile and
      // promotion already hold a transaction, and Postgres will not let it
      // continue after P2002. Those callers share lockAssignment, so a missing
      // row waits instead of failing. A leftover unique violation still aborts
      // their request; the client retries the whole request.
      if (!isUniqueViolation(error)) throw error;
      return this.recoverLostInsert(userId, resolved.onTrainerProgram, error);
    }
  }

  async getAssignedProgram(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<{ program: AssignedProgramResponse | null }> {
    const program = await this.loadProgram(userId, db);
    if (!program) return { program: null };
    return { program: await this.withProgramCycle(userId, program, db) };
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

  /** Takes the assignment lock before any other write in the caller's transaction. */
  async holdAssignment(userId: string, db: ProgramStore): Promise<void> {
    await lockAssignment(db, userId);
  }

  async unassign(
    userId: string,
    db: ProgramStore = this.prisma,
  ): Promise<void> {
    const run = (store: ProgramStore) => this.unassignLocked(userId, store);
    if (db === this.prisma) {
      await this.prisma.$transaction(run);
      return;
    }
    await run(db);
  }

  async assignTemplate(
    userId: string,
    templateId: string,
  ): Promise<TemplateAssignmentResult> {
    return this.prisma.$transaction((db) =>
      this.assignTemplateLocked(userId, templateId, db),
    );
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
        // Before onboarding or program writes, so this transaction and
        // POST /programs/assign take the user lock in the same order.
        await lockAssignment(tx, userId);
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

  private async assignLocked(
    userId: string,
    db: ProgramStore,
    options: AssignOptions,
  ): Promise<AssignedProgramResponse> {
    const locked = await lockAssignment(db, userId);
    if (locked?.assignmentSource === 'ADMIN') {
      if (options.onTrainerProgram === 'reject') {
        throw new ConflictException(ADMIN_PROGRAM_ASSIGNED);
      }
      return this.currentProgram(userId, db);
    }
    if (locked?.origin === 'TRAINER') {
      if (options.onTrainerProgram === 'reject') {
        throw new ConflictException(TRAINER_PROGRAM_ASSIGNED);
      }
      return this.currentProgram(userId, db);
    }

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
      where: { ...match, active: true, origin: 'SYSTEM' },
    });
    if (!template) throw new NotFoundException(PROGRAM_NOT_AVAILABLE);

    if (options.preserveAssignedAt && locked?.templateId === template.id) {
      return this.currentProgram(userId, db);
    }

    if (!locked) {
      const program = await db.workoutProgram.create({
        data: { userId, templateId: template.id },
        include: programInclude,
      });
      return this.withProgramCycle(userId, toAssignedProgram(program), db);
    }

    const program = await db.workoutProgram.update({
      where: { userId },
      data: { templateId: template.id, assignedAt: new Date() },
      include: programInclude,
    });
    return this.withProgramCycle(userId, toAssignedProgram(program), db);
  }

  private async assignTemplateLocked(
    userId: string,
    templateId: string,
    db: ProgramStore,
  ): Promise<TemplateAssignmentResult> {
    const locked = await lockAssignment(db, userId);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    if (!user || user.role !== 'CLIENT') {
      throw new NotFoundException(CLIENT_NOT_FOUND);
    }

    const template = await db.programTemplate.findUnique({
      where: { id: templateId },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: {
                exercise: { select: { name: true, nameEn: true } },
              },
            },
          },
        },
      },
    });
    if (!template) throw new NotFoundException(TEMPLATE_NOT_FOUND);
    if (!template.active) throw new ConflictException(TEMPLATE_INACTIVE);

    if (locked?.templateId === template.id) {
      const program =
        locked.assignmentSource === 'MATCHED'
          ? await this.withProgramCycle(
              userId,
              toAssignedProgram(
                await db.workoutProgram.update({
                  where: { userId },
                  data: { assignmentSource: 'ADMIN' },
                  include: programInclude,
                }),
              ),
              db,
            )
          : await this.currentProgram(userId, db);
      return { program, change: 'unchanged', notice: null };
    }

    const data = {
      templateId: template.id,
      assignmentSource: 'ADMIN' as const,
      assignedAt: new Date(),
    };
    const record = locked
      ? await db.workoutProgram.update({
          where: { userId },
          data,
          include: programInclude,
        })
      : await db.workoutProgram.create({
          data: { userId, ...data },
          include: programInclude,
        });
    return {
      program: await this.withProgramCycle(
        userId,
        toAssignedProgram(record),
        db,
      ),
      change: locked ? 'replaced' : 'assigned',
      notice: {
        to: user.email,
        kind: locked ? 'updated' : 'assigned',
        name: template.name,
        origin: template.origin,
        frequencyPerWeek: template.frequencyPerWeek,
        days: template.days.map((day) => ({
          exercises: day.exercises.map((row) => ({
            name: row.exercise.name,
            nameEn: row.exercise.nameEn,
          })),
        })),
      },
    };
  }

  private async recoverLostInsert(
    userId: string,
    onTrainerProgram: AssignOptions['onTrainerProgram'],
    cause: unknown,
  ): Promise<AssignedProgramResponse> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await lockAssignment(tx, userId);
      if (!locked) throw cause;
      if (
        locked.assignmentSource === 'ADMIN' &&
        onTrainerProgram === 'reject'
      ) {
        throw new ConflictException(ADMIN_PROGRAM_ASSIGNED);
      }
      if (locked.origin === 'TRAINER' && onTrainerProgram === 'reject') {
        throw new ConflictException(TRAINER_PROGRAM_ASSIGNED);
      }
      return this.currentProgram(userId, tx);
    });
  }

  private async unassignLocked(
    userId: string,
    db: ProgramStore,
  ): Promise<void> {
    const locked = await lockAssignment(db, userId);
    // A miss deletes nothing. The user lock is still held, so a concurrent
    // insert cannot commit a row for this delete to remove.
    if (
      !locked ||
      locked.origin === 'TRAINER' ||
      locked.assignmentSource === 'ADMIN'
    ) {
      return;
    }
    await db.workoutProgram.deleteMany({
      where: { userId, templateId: locked.templateId },
    });
  }

  private async currentProgram(
    userId: string,
    db: ProgramStore,
  ): Promise<AssignedProgramResponse> {
    const current = await this.loadProgram(userId, db);
    if (!current) throw new NotFoundException(PROGRAM_NOT_AVAILABLE);
    return this.withProgramCycle(userId, current, db);
  }

  private async promotionFor(
    userId: string,
    db: ProgramStore,
  ): Promise<ProgramPromotion | null> {
    const assigned = await db.workoutProgram.findUnique({
      where: { userId },
      select: {
        assignmentSource: true,
        template: { select: { origin: true } },
      },
    });
    if (
      assigned?.assignmentSource === 'ADMIN' ||
      assigned?.template?.origin === 'TRAINER'
    ) {
      return null;
    }

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
          origin: 'SYSTEM',
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
        origin: 'SYSTEM',
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
    const groups = await db.workoutLog.groupBy({
      by: ['dayNumber'],
      where: loggedSinceAssignment,
      _count: { _all: true },
    });
    const dayLogCounts = groups
      .map((group) => ({
        dayNumber: group.dayNumber,
        count: group._count._all,
      }))
      .sort((left, right) => left.dayNumber - right.dayNumber);

    return {
      ...program,
      nextDayNumber: nextProgramDay(dayLogCounts, program.frequencyPerWeek),
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
    templateOrigin: program.templateOrigin,
    assignmentSource: program.assignmentSource,
    assignedAt: program.assignedAt,
    nextDayNumber: program.nextDayNumber,
    programProgress: program.programProgress,
    dayLogCounts: program.dayLogCounts,
  };
}

function toAssignedSummary(program: {
  id: string;
  assignedAt: Date;
  assignmentSource: 'MATCHED' | 'ADMIN';
  template: {
    id: string;
    code: string;
    name: string;
    gender: string;
    level: string;
    frequencyPerWeek: number;
    accent: string;
    origin: 'SYSTEM' | 'TRAINER';
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
    templateOrigin: program.template.origin,
    assignmentSource: program.assignmentSource,
    assignedAt: program.assignedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

// Serializes every assignment writer for this user until that transaction
// commits or rolls back, including when no workout_programs row exists.
// FOR UPDATE alone cannot lock a missing row. pg_advisory_xact_lock returns
// void, which this Prisma client's $queryRaw cannot decode; $executeRaw still
// runs the statement on the surrounding transaction's connection.
// assign, unassign, and a future trainer assignment must call this on the
// same transaction client that creates, updates, or deletes the row. The root
// client would release the lock before the next statement. A writer that
// skips it can still change the row underneath them.
export async function lockAssignment(
  db: ProgramStore,
  userId: string,
): Promise<AssignmentLock | null> {
  await db.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0::bigint))
  `;
  const rows = await db.$queryRaw<AssignmentLock[]>`
    SELECT pt.origin, wp.template_id AS "templateId",
           wp.assignment_source AS "assignmentSource"
    FROM workout_programs wp
    JOIN program_templates pt ON pt.id = wp.template_id
    WHERE wp.user_id = CAST(${userId} AS uuid)
    FOR UPDATE OF wp
  `;
  return rows[0] ?? null;
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
