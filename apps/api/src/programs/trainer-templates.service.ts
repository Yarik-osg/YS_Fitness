import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ProgramTemplate, type UserRole } from '@prisma/client';
import type {
  MuscleGroup,
  ProgramAccent,
  ProgramDayResponse,
  TrainerProgramTemplateDetail,
  TrainerProgramTemplateListResponse,
  TrainerProgramTemplateSummary,
  TrainingExperience,
} from '@repo/shared-types';
import type { TrainerTemplateBody } from '@repo/validation';
import { PrismaService } from '../prisma/prisma.service.js';

const CODE_ATTEMPTS = 5;

const detailInclude = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      exercises: {
        orderBy: { order: 'asc' as const },
        include: { exercise: true },
      },
    },
  },
} satisfies Prisma.ProgramTemplateInclude;

type TemplateDetail = Prisma.ProgramTemplateGetPayload<{
  include: typeof detailInclude;
}>;

type Writer = Prisma.TransactionClient;

export type TrainerTemplateActor = {
  id: string;
  role: UserRole;
};

type LockedTemplate = {
  id: string;
  origin: ProgramTemplate['origin'];
  ownerId: string | null;
};

@Injectable()
export class TrainerTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: TrainerTemplateActor,
  ): Promise<TrainerProgramTemplateListResponse> {
    this.assertCoach(actor);
    const templates = await this.prisma.programTemplate.findMany({
      where: { origin: 'TRAINER' },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });
    return { templates: templates.map(toSummary) };
  }

  async get(
    actor: TrainerTemplateActor,
    templateId: string,
  ): Promise<TrainerProgramTemplateDetail> {
    this.assertCoach(actor);
    const template = await this.prisma.programTemplate.findUnique({
      where: { id: templateId },
      include: detailInclude,
    });
    this.assertVisible(template);
    return toDetail(template);
  }

  async create(
    actor: TrainerTemplateActor,
    input: TrainerTemplateBody,
  ): Promise<TrainerProgramTemplateDetail> {
    this.assertCoach(actor);
    return this.write((db) =>
      this.insert(db, input, { ownerId: actor.id, active: true }),
    );
  }

  async update(
    actor: TrainerTemplateActor,
    templateId: string,
    input: TrainerTemplateBody,
  ): Promise<TrainerProgramTemplateDetail> {
    this.assertCoach(actor);
    return this.prisma.$transaction(async (db) => {
      const locked = await lockTemplate(db, templateId);
      this.assertVisible(locked);
      const logs = await db.workoutLog.count({ where: { templateId } });
      if (logs > 0) {
        throw new ConflictException({
          code: 'TEMPLATE_HAS_LOGS',
          message: 'A template with workout logs cannot be edited',
        });
      }
      await this.assertExercises(db, input);
      await db.programTemplateDay.deleteMany({ where: { templateId } });
      const template = await db.programTemplate.update({
        where: { id: templateId },
        data: {
          ...templateFields(input),
          days: { create: dayCreates(input) },
        },
        include: detailInclude,
      });
      return toDetail(template);
    });
  }

  // Copies onto a new id. Assigning that copy is a later change.
  async duplicate(
    actor: TrainerTemplateActor,
    templateId: string,
  ): Promise<TrainerProgramTemplateDetail> {
    this.assertCoach(actor);
    return this.write(async (db) => {
      const locked = await lockTemplate(db, templateId);
      this.assertVisible(locked);
      const source = await db.programTemplate.findUnique({
        where: { id: templateId },
        include: detailInclude,
      });
      this.assertVisible(source);
      return this.insert(db, bodyFromTemplate(source), {
        ownerId: source.ownerId,
        active: source.active,
      });
    });
  }

  async remove(actor: TrainerTemplateActor, templateId: string): Promise<void> {
    this.assertCoach(actor);
    await this.prisma.$transaction(async (db) => {
      const locked = await lockTemplate(db, templateId);
      this.assertVisible(locked);
      const [programs, logs] = await Promise.all([
        db.workoutProgram.count({ where: { templateId } }),
        db.workoutLog.count({ where: { templateId } }),
      ]);
      if (programs > 0 || logs > 0) {
        throw new ConflictException({
          code: 'TEMPLATE_IN_USE',
          message: 'An assigned or logged template cannot be deleted',
        });
      }
      await db.programTemplate.delete({ where: { id: templateId } });
    });
  }

  private async write<T>(work: (db: Writer) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction((db) => work(db));
      } catch (error) {
        if (!isCodeCollision(error) || attempt === CODE_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    throw new Error('Trainer template code was not written');
  }

  private async insert(
    db: Writer,
    input: TrainerTemplateBody,
    fields: { ownerId: string; active: boolean },
  ): Promise<TrainerProgramTemplateDetail> {
    await this.assertExercises(db, input);
    const template = await db.programTemplate.create({
      data: {
        code: trainerCode(),
        ...templateFields(input),
        origin: 'TRAINER',
        ownerId: fields.ownerId,
        active: fields.active,
        days: { create: dayCreates(input) },
      },
      include: detailInclude,
    });
    return toDetail(template);
  }

  private async assertExercises(
    db: Writer,
    input: TrainerTemplateBody,
  ): Promise<void> {
    const ids = [
      ...new Set(
        input.days.flatMap((day) =>
          day.exercises.map((exercise) => exercise.exerciseId),
        ),
      ),
    ];
    const found = await db.exercise.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'An exercise on this template does not exist',
      });
    }
  }

  private assertCoach(
    actor: TrainerTemplateActor,
  ): asserts actor is TrainerTemplateActor & { role: 'ADMIN' } {
    if (actor.role === 'ADMIN') return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action',
    });
  }

  private assertVisible<T extends LockedTemplate>(
    template: T | null,
  ): asserts template is T & { origin: 'TRAINER'; ownerId: string } {
    if (!template || template.origin !== 'TRAINER' || !template.ownerId) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Program template not found',
      });
    }
  }
}

function trainerCode(): string {
  return `T${randomBytes(7).toString('hex')}`;
}

function isCodeCollision(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === 'string'
      ? [target]
      : [];
  return (
    fields.length > 0 &&
    fields.every((field) => field === 'code' || field.endsWith('_code_key'))
  );
}

async function lockTemplate(
  db: Writer,
  templateId: string,
): Promise<LockedTemplate | null> {
  const rows = await db.$queryRaw<LockedTemplate[]>`
    SELECT id, origin, owner_id AS "ownerId"
    FROM program_templates
    WHERE id = CAST(${templateId} AS uuid)
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

function templateFields(input: TrainerTemplateBody) {
  return {
    name: input.name,
    gender: input.gender === 'female' ? 'FEMALE' : 'MALE',
    level:
      input.level === 'beginner'
        ? 'BEGINNER'
        : input.level === 'intermediate'
          ? 'INTERMEDIATE'
          : 'ADVANCED',
    frequencyPerWeek: input.frequencyPerWeek,
    accent: input.accent,
  } as const;
}

function dayCreates(input: TrainerTemplateBody) {
  return input.days.map((day) => ({
    dayNumber: day.dayNumber,
    exercises: {
      create: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        sets: exercise.sets,
        repsMin: exercise.repsMin,
        repsMax: exercise.repsMax,
        allowsAbsAddon: exercise.allowsAbsAddon,
      })),
    },
  }));
}

function bodyFromTemplate(template: TemplateDetail): TrainerTemplateBody {
  return {
    name: template.name,
    gender: template.gender === 'FEMALE' ? 'female' : 'male',
    level: template.level.toLowerCase() as TrainerTemplateBody['level'],
    frequencyPerWeek: template.frequencyPerWeek as 2 | 3 | 4,
    accent: template.accent,
    days: template.days.map((day) => ({
      dayNumber: day.dayNumber,
      exercises: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        sets: exercise.sets,
        repsMin: exercise.repsMin,
        repsMax: exercise.repsMax,
        allowsAbsAddon: exercise.allowsAbsAddon,
      })),
    })),
  };
}

function toSummary(template: ProgramTemplate): TrainerProgramTemplateSummary {
  if (!template.ownerId || template.origin !== 'TRAINER') {
    throw new NotFoundException({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Program template not found',
    });
  }
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    gender: template.gender === 'FEMALE' ? 'female' : 'male',
    level: template.level.toLowerCase() as TrainingExperience,
    frequencyPerWeek: template.frequencyPerWeek,
    accent: template.accent as ProgramAccent,
    active: template.active,
    ownerId: template.ownerId,
  };
}

function toDetail(template: TemplateDetail): TrainerProgramTemplateDetail {
  return {
    ...toSummary(template),
    days: template.days.map((day): ProgramDayResponse => ({
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
          muscleGroups: row.exercise.muscleGroups as MuscleGroup[],
          repsMin: row.repsMin,
          repsMax: row.repsMax,
        },
      })),
    })),
  };
}
