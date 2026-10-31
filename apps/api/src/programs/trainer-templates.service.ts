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
  ExerciseResponse,
  MuscleGroup,
  ProgramAccent,
  ProgramDayResponse,
  TrainerProgramTemplateDetail,
  TrainerProgramTemplateListResponse,
  TrainerProgramTemplateSummary,
  TrainingExperience,
} from '@repo/shared-types';
import {
  trainerTemplateBodySchema,
  type TrainerTemplateBody,
} from '@repo/validation';
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
    const [templates, assigned] = await Promise.all([
      this.prisma.programTemplate.findMany({
        where: { origin: { in: ['SYSTEM', 'TRAINER'] } },
        orderBy: [{ origin: 'asc' }, { name: 'asc' }],
        include: {
          days: { select: { _count: { select: { exercises: true } } } },
        },
      }),
      this.prisma.workoutProgram.groupBy({
        by: ['templateId'],
        _count: { _all: true },
      }),
    ]);
    const assignedCount = new Map(
      assigned.map((row) => [row.templateId, row._count._all]),
    );
    return {
      templates: templates.map((template) =>
        toSummary(template, assignedCount.get(template.id) ?? 0),
      ),
    };
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
    this.assertReadable(template);
    const [assignedCount, logCount] = await Promise.all([
      this.prisma.workoutProgram.count({ where: { templateId } }),
      this.prisma.workoutLog.count({ where: { templateId } }),
    ]);
    return toDetail(template, assignedCount, logCount);
  }

  async listExercises(
    actor: TrainerTemplateActor,
  ): Promise<ExerciseResponse[]> {
    this.assertCoach(actor);
    const exercises = await this.prisma.exercise.findMany({
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
    return exercises.map((exercise) => ({
      id: exercise.id,
      code: exercise.code,
      name: exercise.name,
      nameEn: exercise.nameEn,
      muscleGroups: exercise.muscleGroups as MuscleGroup[],
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
    }));
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
      const [programs, logs] = await Promise.all([
        db.workoutProgram.count({ where: { templateId } }),
        db.workoutLog.count({ where: { templateId } }),
      ]);
      if (logs > 0) {
        throw new ConflictException({
          code: 'TEMPLATE_HAS_LOGS',
          message: 'A template with workout logs cannot be edited',
        });
      }
      if (programs > 0) {
        throw new ConflictException({
          code: 'TEMPLATE_IN_USE',
          message: 'An assigned template cannot be edited',
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
      return toDetail(template, 0, 0);
    });
  }

  async rename(
    actor: TrainerTemplateActor,
    templateId: string,
    name: string,
  ): Promise<TrainerProgramTemplateDetail> {
    this.assertCoach(actor);
    return this.prisma.$transaction(async (db) => {
      const locked = await lockTemplate(db, templateId);
      this.assertVisible(locked);
      const template = await db.programTemplate.update({
        where: { id: templateId },
        data: { name },
        include: detailInclude,
      });
      const [assignedCount, logCount] = await Promise.all([
        db.workoutProgram.count({ where: { templateId } }),
        db.workoutLog.count({ where: { templateId } }),
      ]);
      return toDetail(template, assignedCount, logCount);
    });
  }

  // Copies onto a new id. Assigning that copy is a later change.
  async duplicate(
    actor: TrainerTemplateActor,
    templateId: string,
  ): Promise<TrainerProgramTemplateDetail> {
    this.assertCoach(actor);
    const preview = await this.prisma.programTemplate.findUnique({
      where: { id: templateId },
      include: detailInclude,
    });
    if (preview?.origin === 'SYSTEM') {
      this.assertReadable(preview);
      const body = { ...copiedBody(preview), name: copyName(preview.name) };
      return this.write((db) =>
        this.insert(db, body, { ownerId: actor.id, active: true }),
      );
    }
    return this.write(async (db) => {
      const locked = await lockTemplate(db, templateId);
      this.assertVisible(locked);
      const source = await db.programTemplate.findUnique({
        where: { id: templateId },
        include: detailInclude,
      });
      this.assertVisible(source);
      const body = bodyFromTemplate(source);
      return this.insert(
        db,
        { ...body, name: copyName(body.name) },
        {
          ownerId: source.ownerId,
          active: source.active,
        },
      );
    });
  }

  async remove(actor: TrainerTemplateActor, templateId: string): Promise<void> {
    this.assertCoach(actor);
    await this.prisma.$transaction(async (db) => {
      const locked = await lockTemplate(db, templateId);
      this.assertVisible(locked);
      const programs = await db.workoutProgram.count({
        where: { templateId },
      });
      if (programs > 0) {
        throw new ConflictException({
          code: 'TEMPLATE_IN_USE',
          message: 'An assigned template cannot be deleted',
        });
      }
      const template = await db.programTemplate.findUnique({
        where: { id: templateId },
        select: { code: true, name: true },
      });
      if (!template) {
        throw new NotFoundException({
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Program template not found',
        });
      }
      // Copy the name and the rep range before the program row goes away.
      await keepPrescribedReps(db, templateId);
      await db.workoutLog.updateMany({
        where: { templateId },
        data: {
          templateId: null,
          templateCode: template.code,
          templateName: template.name,
        },
      });
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
    return toDetail(template, 0, 0);
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

  private assertReadable<T extends LockedTemplate>(
    template: T | null,
  ): asserts template is T &
    (
      | { origin: 'SYSTEM'; ownerId: null }
      | { origin: 'TRAINER'; ownerId: string }
    ) {
    if (
      template &&
      ((template.origin === 'SYSTEM' && template.ownerId === null) ||
        (template.origin === 'TRAINER' && template.ownerId))
    ) {
      return;
    }
    throw new NotFoundException({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Program template not found',
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

async function keepPrescribedReps(
  db: Writer,
  templateId: string,
): Promise<void> {
  // Exact order wins. Otherwise use the lowest order of that exercise on the day,
  // matching the suggestion lookup used while the program still exists.
  await db.$executeRaw`
    UPDATE workout_log_sets AS logged
    SET prescribed_reps_min = match.reps_min,
        prescribed_reps_max = match.reps_max
    FROM (
      SELECT
        logged_set.id,
        COALESCE(exact.reps_min, fallback.reps_min) AS reps_min,
        COALESCE(exact.reps_max, fallback.reps_max) AS reps_max
      FROM workout_log_sets AS logged_set
      JOIN workout_logs AS workout_log
        ON workout_log.id = logged_set.workout_log_id
      JOIN program_template_days AS day
        ON day.template_id = workout_log.template_id
       AND day.day_number = workout_log.day_number
      LEFT JOIN program_template_exercises AS exact
        ON exact.template_day_id = day.id
       AND exact.exercise_id = logged_set.exercise_id
       AND exact."order" = logged_set."order"
      LEFT JOIN LATERAL (
        SELECT reps_min, reps_max
        FROM program_template_exercises AS exercise_row
        WHERE exercise_row.template_day_id = day.id
          AND exercise_row.exercise_id = logged_set.exercise_id
        ORDER BY exercise_row."order"
        LIMIT 1
      ) AS fallback ON exact.id IS NULL
      WHERE workout_log.template_id = CAST(${templateId} AS uuid)
        AND COALESCE(exact.reps_min, fallback.reps_min) IS NOT NULL
    ) AS match
    WHERE logged.id = match.id
  `;
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

function copyName(name: string) {
  const suffix = ' - copy';
  const base = name
    .trim()
    .slice(0, 200 - suffix.length)
    .trimEnd();
  return `${base}${suffix}`;
}

function copiedBody(template: TemplateDetail): TrainerTemplateBody {
  const parsed = trainerTemplateBodySchema.safeParse(
    bodyFromTemplate(template),
  );
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'TEMPLATE_NOT_COPYABLE',
      message: 'This template cannot be copied into a custom program',
    });
  }
  return parsed.data;
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

type SummaryDay = {
  exercises?: readonly unknown[];
  _count?: { exercises: number };
};

type SummaryTemplate = {
  id: string;
  code: string;
  name: string;
  gender: ProgramTemplate['gender'];
  level: ProgramTemplate['level'];
  frequencyPerWeek: number;
  accent: ProgramTemplate['accent'];
  origin: ProgramTemplate['origin'];
  ownerId: string | null;
  active: boolean;
  days: SummaryDay[];
};

function toSummary(
  template: SummaryTemplate,
  assignedCount: number,
): TrainerProgramTemplateSummary {
  if (!(
    (template.origin === 'SYSTEM' && template.ownerId === null) ||
    (template.origin === 'TRAINER' && template.ownerId)
  )) {
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
    origin: template.origin,
    active: template.active,
    ownerId: template.ownerId,
    assignedCount,
    dayCount: template.days.length,
    exerciseCount: template.days.reduce((sum, day) => {
      if (day.exercises) return sum + day.exercises.length;
      return sum + (day._count?.exercises ?? 0);
    }, 0),
  };
}

function toDetail(
  template: TemplateDetail,
  assignedCount: number,
  logCount: number,
): TrainerProgramTemplateDetail {
  return {
    ...toSummary(template, assignedCount),
    logCount,
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
