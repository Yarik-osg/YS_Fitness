import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ProgramsService } from './programs.service.js';

const userId = '33333333-3333-4333-8333-333333333333';

function onboarding(overrides: Record<string, unknown> = {}) {
  return {
    userId,
    programTrack: 'FEMALE',
    experience: 'BEGINNER',
    trainingFrequency: '2',
    focusAreas: ['shoulders'],
    ...overrides,
  };
}

function assignedProgram() {
  return {
    id: 'program-1',
    userId,
    templateId: 'template-1',
    assignedAt: new Date('2026-09-27T00:00:00.000Z'),
    template: {
      id: 'template-1',
      code: 'WB2U',
      name: 'WB2U — Жінки · Початковий рівень · 2 тренування на тиждень · Акцент на верх',
      gender: 'FEMALE',
      level: 'BEGINNER',
      frequencyPerWeek: 2,
      accent: 'UPPER',
      days: [
        {
          dayNumber: 1,
          exercises: [
            {
              order: 1,
              sets: 3,
              repsMin: 10,
              repsMax: 12,
              allowsAbsAddon: true,
              exercise: {
                id: 'exercise-1',
                code: 'EX_039',
                name: 'Тяга вертикального блоку',
                nameEn: 'Lat pulldown',
                muscleGroups: ['BACK', 'BICEPS'],
                repsMin: 10,
                repsMax: 12,
              },
            },
          ],
        },
      ],
    },
  };
}

function createService() {
  const prisma = {
    onboardingResponses: { findUnique: vi.fn(), update: vi.fn() },
    programTemplate: { findFirst: vi.fn(), findMany: vi.fn() },
    workoutProgram: {
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    exercise: { findMany: vi.fn() },
    workoutLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(
      async (fn: (db: unknown) => Promise<unknown>, options?: unknown) => {
        void options;
        return fn({ ...prisma });
      },
    ),
  };

  return { prisma, service: new ProgramsService(prisma as never) };
}

describe('ProgramsService', () => {
  it('returns a null program before the first assignment', async () => {
    const { prisma, service } = createService();
    prisma.workoutProgram.findUnique.mockResolvedValue(null);

    await expect(service.getMine(userId)).resolves.toEqual({ program: null });
  });

  it('upserts the matched female template', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue({ id: 'template-1' });
    prisma.workoutProgram.create.mockResolvedValue(assignedProgram());

    const result = await service.assign(userId);

    expect(prisma.programTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        gender: 'FEMALE',
        level: 'BEGINNER',
        frequencyPerWeek: 2,
        accent: 'UPPER',
        active: true,
        origin: 'SYSTEM',
      },
    });
    expect(prisma.workoutProgram.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId, templateId: 'template-1' },
      }),
    );
    expect(result).toMatchObject({
      templateCode: 'WB2U',
      templateName:
        'WB2U — Жінки · Початковий рівень · 2 тренування на тиждень · Акцент на верх',
      days: [
        {
          exercises: [
            {
              sets: 3,
              allowsAbsAddon: true,
              exercise: {
                name: 'Тяга вертикального блоку',
                nameEn: 'Lat pulldown',
                repsMin: 10,
                repsMax: 12,
              },
            },
          ],
        },
      ],
    });
  });

  it('assigns the male template for the selected focus', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(
      onboarding({ programTrack: 'MALE', focusAreas: ['glutes'] }),
    );
    prisma.programTemplate.findFirst.mockResolvedValue({ id: 'template-1' });
    prisma.workoutProgram.create.mockResolvedValue(assignedProgram());

    await service.assign(userId);

    expect(prisma.programTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        gender: 'MALE',
        level: 'BEGINNER',
        frequencyPerWeek: 2,
        accent: 'LEGS',
        active: true,
        origin: 'SYSTEM',
      },
    });
  });

  it('returns the template prescription when it differs from the catalog', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    const row = record.template.days[0]?.exercises[0];
    if (!row) throw new Error('missing row');
    row.repsMin = 8;
    row.repsMax = 12;
    row.exercise.repsMin = 10;
    row.exercise.repsMax = 12;
    prisma.workoutProgram.findUnique.mockResolvedValue(record);

    const result = await service.getMine(userId);

    expect(result.program?.days[0]?.exercises[0]?.exercise).toMatchObject({
      repsMin: 8,
      repsMax: 12,
    });
  });

  it('throws PROGRAM_NOT_AVAILABLE when the template is missing', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue(null);

    await expect(service.assign(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.workoutProgram.create).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });

  it('keeps the start date when the matched template is unchanged', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue({ id: 'template-1' });
    prisma.$queryRaw.mockResolvedValue([
      { origin: 'SYSTEM', templateId: 'template-1' },
    ]);
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());

    const result = await service.assign(userId, undefined, {
      preserveAssignedAt: true,
    });

    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.create).not.toHaveBeenCalled();
    expect(result.assignedAt).toBe('2026-09-27T00:00:00.000Z');
  });

  it('returns assigned metadata without workout days', async () => {
    const { prisma, service } = createService();
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());

    const result = await service.getAssigned(userId);

    expect(result.program).toMatchObject({
      templateCode: 'WB2U',
      templateName:
        'WB2U — Жінки · Початковий рівень · 2 тренування на тиждень · Акцент на верх',
      frequencyPerWeek: 2,
      level: 'beginner',
    });
    expect(result.program).not.toHaveProperty('days');
    expect(prisma.workoutProgram.findUnique).toHaveBeenCalledWith({
      where: { userId },
      include: { template: true },
    });
  });

  it('starts the rotation at day 1 when this assignment has no logs', async () => {
    const { prisma, service } = createService();
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());

    const result = await service.getMine(userId);

    expect(result.program).toMatchObject({
      nextDayNumber: 1,
      programProgress: { completed: 0, expected: 16 },
      dayLogCounts: [],
    });
    expect(prisma.workoutLog.findFirst).toHaveBeenCalledWith({
      where: {
        userId,
        templateId: 'template-1',
        completedAt: { gte: new Date('2026-09-27T00:00:00.000Z') },
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      select: { dayNumber: true },
    });
  });

  it('advances from the latest logged day', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    record.template.frequencyPerWeek = 3;
    prisma.workoutProgram.findUnique.mockResolvedValue(record);
    prisma.workoutLog.findFirst.mockResolvedValue({ dayNumber: 2 });

    const result = await service.getMine(userId);

    expect(result.program?.nextDayNumber).toBe(3);
  });

  it('wraps the last day back to day 1', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    record.template.frequencyPerWeek = 4;
    prisma.workoutProgram.findUnique.mockResolvedValue(record);
    prisma.workoutLog.findFirst.mockResolvedValue({ dayNumber: 4 });

    const result = await service.getMine(userId);

    expect(result.program?.nextDayNumber).toBe(1);
  });

  it('counts logs since this assignment and lets the count pass the target', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    record.template.id = 'template-new';
    record.template.frequencyPerWeek = 3;
    record.assignedAt = new Date('2026-10-01T00:00:00.000Z');
    prisma.workoutProgram.findUnique.mockResolvedValue(record);
    prisma.workoutLog.groupBy.mockResolvedValue([
      { dayNumber: 2, _count: { _all: 10 } },
      { dayNumber: 1, _count: { _all: 16 } },
    ]);

    const result = await service.getAssigned(userId);

    expect(result.program?.programProgress).toEqual({
      completed: 26,
      expected: 24,
    });
    expect(result.program?.dayLogCounts).toEqual([
      { dayNumber: 1, count: 16 },
      { dayNumber: 2, count: 10 },
    ]);
    expect(prisma.workoutLog.groupBy).toHaveBeenCalledWith({
      by: ['dayNumber'],
      where: {
        userId,
        templateId: 'template-new',
        completedAt: { gte: new Date('2026-10-01T00:00:00.000Z') },
      },
      _count: { _all: true },
    });
  });

  it('removes the assigned program', async () => {
    const { prisma, service } = createService();
    prisma.$queryRaw.mockResolvedValue([
      { origin: 'SYSTEM', templateId: 'template-1' },
    ]);

    await service.unassign(userId);

    expect(prisma.workoutProgram.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  it('does not replace or match over a trainer assignment', async () => {
    const { prisma, service } = createService();
    prisma.$queryRaw.mockResolvedValue([
      { origin: 'TRAINER', templateId: 'trainer-template' },
    ]);

    await expect(service.assign(userId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.programTemplate.findFirst).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.create).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });

  it('returns the trainer assignment when the profile keeps it', async () => {
    const { prisma, service } = createService();
    prisma.$queryRaw.mockResolvedValue([
      { origin: 'TRAINER', templateId: 'trainer-template' },
    ]);
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());

    const result = await service.assign(userId, undefined, {
      onTrainerProgram: 'keep',
    });

    expect(result.templateCode).toBe('WB2U');
    expect(prisma.workoutProgram.create).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });

  it('does not delete a trainer assignment', async () => {
    const { prisma, service } = createService();
    prisma.$queryRaw.mockResolvedValue([
      { origin: 'TRAINER', templateId: 'trainer-template' },
    ]);

    await service.unassign(userId);

    expect(prisma.workoutProgram.deleteMany).not.toHaveBeenCalled();
  });

  it('reads the committed trainer row after a lost insert and does not write again', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue({ id: 'template-1' });
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { origin: 'TRAINER', templateId: 'trainer-template' },
      ]);
    prisma.workoutProgram.create.mockRejectedValue(uniqueViolation());

    await expect(service.assign(userId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.workoutProgram.create).toHaveBeenCalledTimes(1);
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('returns the committed system row after a lost insert without writing again', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue({ id: 'template-1' });
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ origin: 'SYSTEM', templateId: 'template-1' }]);
    prisma.workoutProgram.create.mockRejectedValue(uniqueViolation());
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());

    const result = await service.assign(userId, undefined, {
      onTrainerProgram: 'keep',
    });

    expect(result.templateCode).toBe('WB2U');
    expect(prisma.workoutProgram.create).toHaveBeenCalledTimes(1);
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });

  it('does not insert again when the lost insert left no row', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue({ id: 'template-1' });
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.workoutProgram.create.mockRejectedValue(uniqueViolation());

    await expect(service.assign(userId)).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(prisma.workoutProgram.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: '6.16.2',
  });
}

const nextTemplate = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'WM2U',
  name: 'WM2U intermediate upper',
  gender: 'FEMALE',
  level: 'INTERMEDIATE',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  active: true,
};

const advancedLower = {
  id: '55555555-5555-4555-8555-555555555555',
  code: 'WP2L',
  name: 'WP2L advanced lower',
  gender: 'FEMALE',
  level: 'ADVANCED',
  frequencyPerWeek: 2,
  accent: 'LOWER',
  active: true,
};

const advancedFull = {
  id: '66666666-6666-4666-8666-666666666666',
  code: 'WP2N',
  name: 'WP2N advanced full',
  gender: 'FEMALE',
  level: 'ADVANCED',
  frequencyPerWeek: 2,
  accent: 'NONE',
  active: true,
};

const startedAt = new Date('2026-09-27T00:00:00.000Z');

function atTarget() {
  return [{ dayNumber: 1, _count: { _all: 16 } }];
}

function installPromotion(
  prisma: ReturnType<typeof createService>['prisma'],
  options: {
    record?: ReturnType<typeof assignedProgram>;
    responses?: ReturnType<typeof onboarding>;
    templates?: Array<typeof nextTemplate>;
  } = {},
) {
  let program = options.record ?? assignedProgram();
  let responses = options.responses ?? onboarding();
  const originalResponses = {
    ...responses,
    focusAreas: [...responses.focusAreas],
  };
  const templates = options.templates ?? [nextTemplate];
  prisma.onboardingResponses.findUnique.mockImplementation(
    async () => responses,
  );
  prisma.onboardingResponses.update.mockImplementation(
    async (args: { data: Record<string, unknown> }) => {
      responses = { ...responses, ...args.data };
      return responses;
    },
  );
  prisma.workoutProgram.findUnique.mockImplementation(
    async (args?: { select?: unknown }) =>
      args?.select ? { templateId: program.templateId } : program,
  );
  prisma.programTemplate.findFirst.mockImplementation(
    async (args: {
      where: {
        gender: string;
        level: string;
        frequencyPerWeek: number;
        accent: string;
      };
    }) =>
      templates.find(
        (template) =>
          template.gender === args.where.gender &&
          template.level === args.where.level &&
          template.frequencyPerWeek === args.where.frequencyPerWeek &&
          template.accent === args.where.accent,
      ) ?? null,
  );
  prisma.workoutLog.groupBy.mockImplementation(
    async (args: { where: { completedAt: { gte: Date } } }) =>
      args.where.completedAt.gte.getTime() === startedAt.getTime()
        ? atTarget()
        : [],
  );
  prisma.$queryRaw.mockImplementation(async () => [
    { origin: 'SYSTEM', templateId: program.templateId },
  ]);
  prisma.workoutProgram.update.mockImplementation(
    async (args: { data: { templateId: string; assignedAt: Date } }) => {
      const template = templates.find(
        (item) => item.id === args.data.templateId,
      );
      program = {
        ...program,
        templateId: args.data.templateId,
        assignedAt: args.data.assignedAt,
        template: {
          ...program.template,
          id: args.data.templateId,
          code: template?.code ?? program.template.code,
          name: template?.name ?? program.template.name,
          level: template?.level ?? program.template.level,
          accent: template?.accent ?? program.template.accent,
          frequencyPerWeek:
            template?.frequencyPerWeek ?? program.template.frequencyPerWeek,
          gender: template?.gender ?? program.template.gender,
        },
      };
      return program;
    },
  );

  return {
    responses: () => responses,
    program: () => program,
    apply(data: Record<string, unknown>) {
      responses = { ...responses, ...data };
      return responses;
    },
    restore() {
      responses = {
        ...originalResponses,
        focusAreas: [...originalResponses.focusAreas],
      };
    },
  };
}

function serializationConflict() {
  return new Prisma.PrismaClientKnownRequestError('write conflict', {
    code: 'P2034',
    clientVersion: '6.16.2',
  });
}

describe('program promotion', () => {
  it('offers one same-accent intermediate program to a beginner', async () => {
    const { prisma, service } = createService();
    installPromotion(prisma);
    prisma.workoutLog.groupBy.mockResolvedValue(atTarget());

    const result = await service.getPromotion(userId);

    expect(result).toMatchObject({
      kind: 'level-up',
      fromLevel: 'beginner',
      toLevel: 'intermediate',
      suggestions: [
        {
          id: nextTemplate.id,
          code: 'WM2U',
          accent: 'UPPER',
          level: 'intermediate',
          frequencyPerWeek: 2,
        },
      ],
    });
    expect(prisma.programTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        gender: 'FEMALE',
        level: 'INTERMEDIATE',
        frequencyPerWeek: 2,
        accent: 'UPPER',
        active: true,
        origin: 'SYSTEM',
      },
    });
    expect(prisma.programTemplate.findMany).not.toHaveBeenCalled();
    expect(prisma.onboardingResponses.update).not.toHaveBeenCalled();
  });

  it('offers one same-accent advanced program to an intermediate member', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    record.template.level = 'INTERMEDIATE';
    const advanced = { ...nextTemplate, level: 'ADVANCED', code: 'WP2U' };
    installPromotion(prisma, {
      record,
      responses: onboarding({ experience: 'INTERMEDIATE' }),
      templates: [advanced],
    });
    prisma.workoutLog.groupBy.mockResolvedValue(atTarget());

    const result = await service.getPromotion(userId);

    expect(result).toMatchObject({
      kind: 'level-up',
      fromLevel: 'intermediate',
      toLevel: 'advanced',
      suggestions: [{ id: advanced.id, accent: 'UPPER', level: 'advanced' }],
    });
    expect(prisma.programTemplate.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        level: 'ADVANCED',
        accent: 'UPPER',
      }),
    });
  });

  it('lists other advanced accents in template code order', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    record.template.level = 'ADVANCED';
    installPromotion(prisma, {
      record,
      responses: onboarding({ experience: 'ADVANCED' }),
      templates: [advancedLower, advancedFull],
    });
    prisma.programTemplate.findMany.mockResolvedValue([
      advancedLower,
      advancedFull,
    ]);
    prisma.workoutLog.groupBy.mockResolvedValue(atTarget());

    const result = await service.getPromotion(userId);

    expect(prisma.programTemplate.findMany).toHaveBeenCalledWith({
      where: {
        gender: 'FEMALE',
        level: 'ADVANCED',
        frequencyPerWeek: 2,
        accent: { not: 'UPPER' },
        active: true,
        origin: 'SYSTEM',
      },
      orderBy: { code: 'asc' },
    });
    expect(result?.suggestions.map((item) => item.code)).toEqual([
      'WP2L',
      'WP2N',
    ]);
    expect(result?.suggestions.map((item) => item.accent)).toEqual([
      'LOWER',
      'NONE',
    ]);
  });

  it('offers upper and lower body when the current program is whole body', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    record.template.level = 'ADVANCED';
    record.template.accent = 'NONE';
    record.template.code = 'WP4';
    const upper = {
      ...advancedLower,
      id: '77777777-7777-4777-8777-777777777777',
      code: 'WP4U',
      accent: 'UPPER',
    };
    const lower = { ...advancedLower, code: 'WP4L' };
    installPromotion(prisma, {
      record,
      responses: onboarding({
        experience: 'ADVANCED',
        focusAreas: ['full_body'],
      }),
      templates: [lower, upper],
    });
    prisma.programTemplate.findMany.mockResolvedValue([lower, upper]);
    prisma.workoutLog.groupBy.mockResolvedValue(atTarget());

    const result = await service.getPromotion(userId);

    expect(prisma.programTemplate.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ accent: { not: 'NONE' } }),
      orderBy: { code: 'asc' },
    });
    expect(result?.suggestions.map((item) => item.accent)).toEqual([
      'LOWER',
      'UPPER',
    ]);
    expect(result?.suggestions.map((item) => item.code)).not.toContain('WP4');
  });

  it('returns an empty list at the target when nothing matches', async () => {
    const { prisma, service } = createService();
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());
    prisma.workoutLog.groupBy.mockResolvedValue(atTarget());
    prisma.programTemplate.findFirst.mockResolvedValue(null);

    await expect(service.getPromotion(userId)).resolves.toEqual({
      kind: 'level-up',
      fromLevel: 'beginner',
      toLevel: 'intermediate',
      suggestions: [],
    });
    expect(prisma.onboardingResponses.update).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();

    await expect(
      service.acceptPromotion(userId, nextTemplate.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.onboardingResponses.update).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });

  it('returns null before the session target', async () => {
    const { prisma, service } = createService();
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());

    await expect(service.getPromotion(userId)).resolves.toBeNull();
    expect(prisma.programTemplate.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an id that is not in the eligible set', async () => {
    const { prisma, service } = createService();
    installPromotion(prisma);

    await expect(
      service.acceptPromotion(userId, advancedLower.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.onboardingResponses.update).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });

  it('returns no offer and does not rewrite onboarding for a trainer program', async () => {
    const { prisma, service } = createService();
    prisma.workoutProgram.findUnique.mockResolvedValue({
      template: { origin: 'TRAINER' },
    });

    await expect(service.getPromotion(userId)).resolves.toBeNull();
    await expect(
      service.acceptPromotion(userId, nextTemplate.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.onboardingResponses.update).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.create).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
    expect(prisma.programTemplate.findFirst).not.toHaveBeenCalled();
  });

  it('keeps history, starts a new cycle, and ignores a second accept', async () => {
    const { prisma, service } = createService();
    installPromotion(prisma);

    const accepted = await service.acceptPromotion(userId, nextTemplate.id);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(prisma.onboardingResponses.update).toHaveBeenCalledWith({
      where: { userId },
      data: { experience: 'INTERMEDIATE', focusAreas: ['shoulders'] },
    });
    expect(prisma.workoutProgram.update).toHaveBeenCalledTimes(1);
    expect(
      prisma.workoutProgram.findUnique.mock.calls.some(
        ([args]) =>
          (args as { select?: { templateId?: boolean } } | undefined)?.select
            ?.templateId,
      ),
    ).toBe(false);
    expect(accepted.templateId).toBe(nextTemplate.id);
    expect(accepted.assignedAt).not.toBe(startedAt.toISOString());
    expect(accepted.programProgress).toEqual({ completed: 0, expected: 16 });
    expect(prisma.workoutLog.deleteMany).not.toHaveBeenCalled();

    const reset = await service.getMine(userId);
    expect(reset.program?.programProgress).toEqual({
      completed: 0,
      expected: 16,
    });

    prisma.workoutLog.groupBy.mockResolvedValue([
      { dayNumber: 1, _count: { _all: 1 } },
    ]);
    const later = await service.getMine(userId);
    expect(later.program?.programProgress.completed).toBe(1);

    await expect(
      service.acceptPromotion(userId, nextTemplate.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workoutProgram.update).toHaveBeenCalledTimes(1);
  });

  it('assigns the chosen advanced zone and rewrites its focus', async () => {
    const { prisma, service } = createService();
    const record = assignedProgram();
    record.template.level = 'ADVANCED';
    installPromotion(prisma, {
      record,
      responses: onboarding({ experience: 'ADVANCED' }),
      templates: [advancedLower, advancedFull],
    });
    prisma.programTemplate.findMany.mockResolvedValue([
      advancedLower,
      advancedFull,
    ]);

    const accepted = await service.acceptPromotion(userId, advancedFull.id);

    expect(prisma.onboardingResponses.update).toHaveBeenCalledWith({
      where: { userId },
      data: { experience: 'ADVANCED', focusAreas: ['full_body'] },
    });
    expect(accepted.templateId).toBe(advancedFull.id);
    expect(accepted.accent).toBe('NONE');
    expect(accepted.programProgress.completed).toBe(0);
  });

  it('rolls the onboarding write back with a failed assignment', async () => {
    const { prisma, service } = createService();
    const state = installPromotion(prisma);
    const calls: string[] = [];
    let inside = false;
    prisma.$transaction.mockImplementation(async (fn) => {
      inside = true;
      try {
        return await (fn as (db: unknown) => Promise<unknown>)(prisma);
      } catch (error) {
        state.restore();
        throw error;
      } finally {
        inside = false;
      }
    });
    prisma.onboardingResponses.update.mockImplementation(async (args) => {
      calls.push(inside ? 'update' : 'update-outside');
      return state.apply(args.data);
    });
    prisma.workoutProgram.update.mockImplementation(async () => {
      calls.push(inside ? 'assign' : 'assign-outside');
      throw new Error('assign failed');
    });

    await expect(
      service.acceptPromotion(userId, nextTemplate.id),
    ).rejects.toThrow('assign failed');
    expect(calls).toEqual(['update', 'assign']);
    expect(state.responses().experience).toBe('BEGINNER');
  });

  it('counts the finished sessions inside the accept transaction', async () => {
    const { prisma, service } = createService();
    installPromotion(prisma);
    const txLog = {
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue(atTarget()),
    };
    prisma.$transaction.mockImplementation(async (fn) =>
      (fn as (db: unknown) => Promise<unknown>)({
        ...prisma,
        workoutLog: txLog,
      }),
    );

    await service.acceptPromotion(userId, nextTemplate.id);

    expect(txLog.groupBy).toHaveBeenCalled();
    expect(prisma.workoutLog.groupBy).not.toHaveBeenCalled();
  });

  it('retries a serialization conflict once', async () => {
    const { prisma, service } = createService();
    installPromotion(prisma);
    const run = prisma.$transaction.getMockImplementation();
    let attempts = 0;
    prisma.$transaction.mockImplementation(async (fn, options) => {
      attempts += 1;
      if (attempts === 1) throw serializationConflict();
      if (!run) throw new Error('missing transaction');
      return run(fn, options);
    });

    const accepted = await service.acceptPromotion(userId, nextTemplate.id);

    expect(attempts).toBe(2);
    expect(accepted.templateId).toBe(nextTemplate.id);
  });

  it('does not report success when the retry also conflicts', async () => {
    const { prisma, service } = createService();
    installPromotion(prisma);
    prisma.$transaction.mockRejectedValue(serializationConflict());

    await expect(
      service.acceptPromotion(userId, nextTemplate.id),
    ).rejects.toMatchObject({ code: 'P2034' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });
});
