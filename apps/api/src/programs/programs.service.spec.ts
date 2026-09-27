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
    },
    exercise: { findMany: vi.fn() },
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
});
