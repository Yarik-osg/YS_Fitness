import { NotFoundException } from '@nestjs/common';
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
              allowsAbsAddon: true,
              exercise: {
                id: 'exercise-1',
                code: 'EX_039',
                name: 'Тяга вертикального блоку',
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
    onboardingResponses: { findUnique: vi.fn() },
    programTemplate: { findFirst: vi.fn() },
    workoutProgram: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    exercise: { findMany: vi.fn() },
    workoutLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
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
    prisma.workoutProgram.upsert.mockResolvedValue(assignedProgram());

    const result = await service.assign(userId);

    expect(prisma.programTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        gender: 'FEMALE',
        level: 'BEGINNER',
        frequencyPerWeek: 2,
        accent: 'UPPER',
        active: true,
      },
    });
    expect(prisma.workoutProgram.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        create: { userId, templateId: 'template-1' },
        update: expect.objectContaining({ templateId: 'template-1' }),
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
              exercise: { repsMin: 10, repsMax: 12 },
            },
          ],
        },
      ],
    });
  });

  it('refuses a male track without assigning another template', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(
      onboarding({ programTrack: 'MALE' }),
    );

    await expect(service.assign(userId)).rejects.toMatchObject({
      response: {
        code: 'PROGRAM_NOT_AVAILABLE',
        message: 'No program is available for this track yet',
      },
    });
    expect(prisma.programTemplate.findFirst).not.toHaveBeenCalled();
    expect(prisma.workoutProgram.upsert).not.toHaveBeenCalled();
  });

  it('throws PROGRAM_NOT_AVAILABLE when the template is missing', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue(null);

    await expect(service.assign(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.workoutProgram.upsert).not.toHaveBeenCalled();
  });

  it('keeps the start date when the matched template is unchanged', async () => {
    const { prisma, service } = createService();
    prisma.onboardingResponses.findUnique.mockResolvedValue(onboarding());
    prisma.programTemplate.findFirst.mockResolvedValue({ id: 'template-1' });
    prisma.workoutProgram.findUnique.mockImplementation(
      async (args: { select?: unknown }) =>
        args.select ? { templateId: 'template-1' } : assignedProgram(),
    );

    const result = await service.assign(userId, undefined, {
      preserveAssignedAt: true,
    });

    expect(prisma.workoutProgram.upsert).not.toHaveBeenCalled();
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

  it('starts the rotation at day 1 when this template has no logs', async () => {
    const { prisma, service } = createService();
    prisma.workoutProgram.findUnique.mockResolvedValue(assignedProgram());

    const result = await service.getMine(userId);

    expect(result.program).toMatchObject({
      nextDayNumber: 1,
      programProgress: { completed: 0, expected: 16 },
    });
    expect(prisma.workoutLog.findFirst).toHaveBeenCalledWith({
      where: { userId, templateId: 'template-1' },
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
    prisma.workoutLog.count.mockResolvedValue(26);

    const result = await service.getAssigned(userId);

    expect(result.program?.programProgress).toEqual({
      completed: 26,
      expected: 24,
    });
    expect(prisma.workoutLog.count).toHaveBeenCalledWith({
      where: {
        userId,
        templateId: 'template-new',
        completedAt: { gte: new Date('2026-10-01T00:00:00.000Z') },
      },
    });
  });

  it('removes the assigned program', async () => {
    const { prisma, service } = createService();

    await service.unassign(userId);

    expect(prisma.workoutProgram.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
  });
});
