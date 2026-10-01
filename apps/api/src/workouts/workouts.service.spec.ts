import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AssignedProgramResponse } from '@repo/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutsService } from './workouts.service.js';
import type { WorkoutLogRecord } from './workouts.repository.js';

const templateId = '11111111-1111-4111-8111-111111111111';
const otherTemplateId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const exerciseId = '44444444-4444-4444-8444-444444444444';
const otherExerciseId = '55555555-5555-4555-8555-555555555555';

const program: AssignedProgramResponse = {
  id: 'program-1',
  templateId,
  templateCode: 'WB2U',
  templateName: 'WB2U',
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  assignedAt: '2026-09-27T00:00:00.000Z',
  days: [
    {
      dayNumber: 1,
      exercises: [
        {
          order: 1,
          sets: 3,
          allowsAbsAddon: false,
          exercise: {
            id: exerciseId,
            code: 'EX_039',
            name: 'Row',
            muscleGroups: ['BACK'],
            repsMin: 10,
            repsMax: 12,
          },
        },
      ],
    },
  ],
};

function logRecord(
  overrides: Partial<WorkoutLogRecord> = {},
): WorkoutLogRecord {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    userId,
    templateId,
    dayNumber: 1,
    completedAt: new Date('2026-10-01T12:00:00.000Z'),
    sets: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        workoutLogId: '66666666-6666-4666-8666-666666666666',
        exerciseId,
        order: 1,
        setNumber: 1,
        repsCompleted: 12,
        weightKg: new Prisma.Decimal('35.5'),
        exercise: {
          id: exerciseId,
          code: 'EX_039',
          name: 'Row',
          muscleGroups: ['BACK'],
          repsMin: 10,
          repsMax: 12,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      },
    ],
    ...overrides,
  };
}

const input = {
  templateId,
  dayNumber: 1,
  sets: [
    {
      exerciseId,
      order: 1,
      setNumber: 1,
      repsCompleted: 12,
      weightKg: 35.5,
    },
  ],
};

function createService(
  programs: { getMine: ReturnType<typeof vi.fn> },
  repository: Record<string, ReturnType<typeof vi.fn>> = {},
) {
  const workouts = {
    transaction: vi.fn((work: (client: unknown) => unknown) => work({})),
    create: vi.fn().mockResolvedValue(logRecord()),
    list: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    ...repository,
  };
  return {
    service: new WorkoutsService(workouts as never, programs as never),
    workouts,
  };
}

describe('WorkoutsService.log', () => {
  it('creates a log for the assigned template day', async () => {
    const { service, workouts } = createService({
      getMine: vi.fn().mockResolvedValue({ program }),
    });

    const result = await service.log(userId, input);

    expect(workouts.create).toHaveBeenCalledWith(userId, input, {});
    expect(result.templateId).toBe(templateId);
    expect(result.sets[0]?.weightKg).toBe(35.5);
    expect(result.sets[0]?.exercise.name).toBe('Row');
  });

  it('allows another log for the same day', async () => {
    const { service, workouts } = createService({
      getMine: vi.fn().mockResolvedValue({ program }),
    });

    await service.log(userId, input);
    await service.log(userId, input);

    expect(workouts.create).toHaveBeenCalledTimes(2);
  });

  it('rejects logging when no program is assigned', async () => {
    const { service, workouts } = createService({
      getMine: vi.fn().mockResolvedValue({ program: null }),
    });

    await expect(service.log(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.log(userId, input)).rejects.toMatchObject({
      response: { code: 'PROGRAM_NOT_ASSIGNED' },
    });
    expect(workouts.create).not.toHaveBeenCalled();
  });

  it('rejects a template that is not the assigned one', async () => {
    const { service } = createService({
      getMine: vi.fn().mockResolvedValue({ program }),
    });

    await expect(
      service.log(userId, { ...input, templateId: otherTemplateId }),
    ).rejects.toMatchObject({
      response: { code: 'TEMPLATE_NOT_ASSIGNED' },
    });
  });

  it('rejects a day that is not on the template', async () => {
    const { service } = createService({
      getMine: vi.fn().mockResolvedValue({ program }),
    });

    await expect(
      service.log(userId, { ...input, dayNumber: 9 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.log(userId, { ...input, dayNumber: 9 }),
    ).rejects.toMatchObject({
      response: { code: 'PROGRAM_DAY_NOT_FOUND' },
    });
  });

  it('rejects an exercise that is not on the day', async () => {
    const { service } = createService({
      getMine: vi.fn().mockResolvedValue({ program }),
    });

    await expect(
      service.log(userId, {
        ...input,
        sets: [{ ...input.sets[0]!, exerciseId: otherExerciseId }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.log(userId, {
        ...input,
        sets: [{ ...input.sets[0]!, exerciseId: otherExerciseId }],
      }),
    ).rejects.toMatchObject({
      response: { code: 'EXERCISE_NOT_ON_DAY' },
    });
  });
});

describe('WorkoutsService.list', () => {
  it('returns only the caller logs, newest first', async () => {
    const older = logRecord({
      id: '88888888-8888-4888-8888-888888888888',
      completedAt: new Date('2026-09-01T12:00:00.000Z'),
    });
    const newer = logRecord({
      completedAt: new Date('2026-10-01T12:00:00.000Z'),
    });
    const { service, workouts } = createService(
      { getMine: vi.fn() },
      {
        list: vi.fn().mockResolvedValue([newer, older]),
        count: vi.fn().mockResolvedValue(2),
      },
    );

    const result = await service.list(userId, { limit: 20, offset: 0 });

    expect(workouts.list).toHaveBeenCalledWith(userId, {
      limit: 20,
      offset: 0,
    });
    expect(workouts.count).toHaveBeenCalledWith(userId);
    expect(result.total).toBe(2);
    expect(result.logs.map((log) => log.id)).toEqual([newer.id, older.id]);
    expect(result.logs[0]?.completedAt > result.logs[1]!.completedAt).toBe(
      true,
    );
  });
});
