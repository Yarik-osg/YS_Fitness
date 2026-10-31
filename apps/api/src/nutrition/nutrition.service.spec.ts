import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nutritionProfileSchema } from '@repo/validation';
import { describe, expect, it, vi } from 'vitest';
import { NutritionService } from './nutrition.service.js';

const now = new Date('2026-11-01T12:00:00.000Z');
const userId = 'user-b';

function harness(options?: {
  role?: 'CLIENT' | 'ADMIN';
  profile?: boolean;
  measurement?: boolean;
  frequency?: string;
  active?: { id: string; source: 'CALCULATED' | 'MANUAL' } | null;
  locked?: boolean;
  ageYears?: { dob: string; timezone: string };
  weightKg?: string;
  heightCm?: string;
  activity?: 'SEDENTARY' | 'MODERATE';
  goal?: 'LOSE_WEIGHT' | 'MAINTAIN';
}) {
  const created: { data: Record<string, unknown> }[] = [];
  const targetUpdates: { where: unknown; data: unknown }[] = [];
  const targetCreates: { data: Record<string, unknown> }[] = [];
  const reads: { model: string; args: unknown }[] = [];
  const profile =
    options?.profile === false
      ? null
      : {
          activity: options?.activity ?? 'MODERATE',
          goal: options?.goal ?? 'LOSE_WEIGHT',
          preferences: null,
          allergies: null,
          dislikes: null,
          mealCount: 3,
        };
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue(options?.locked === false ? [] : [{ id: userId }]),
    nutritionTarget: {
      findFirst: vi.fn().mockResolvedValue(options?.active ?? null),
      update: vi.fn(async (args: { where: unknown; data: unknown }) => {
        targetUpdates.push(args);
        return args;
      }),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        targetCreates.push(args);
        return { id: 'target-1', ...args.data };
      }),
    },
    nutritionCalculation: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args);
        return {
          id: 'calc-1',
          createdAt: now,
          ...args.data,
        };
      }),
    },
  };
  const prisma = {
    user: {
      findUnique: vi.fn(async (args: unknown) => {
        reads.push({ model: 'user', args });
        return { role: options?.role ?? 'CLIENT' };
      }),
    },
    nutritionProfile: {
      findUnique: vi.fn(async (args: unknown) => {
        reads.push({ model: 'nutritionProfile', args });
        return profile;
      }),
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => ({
        ...args.create,
      })),
    },
    userProfile: {
      findUnique: vi.fn(async (args: unknown) => {
        reads.push({ model: 'userProfile', args });
        return {
          biologicalSexForCalculation: 'FEMALE',
          heightCm: new Prisma.Decimal(options?.heightCm ?? '165'),
          dateOfBirth: new Date(
            options?.ageYears?.dob ?? '1996-11-01T00:00:00.000Z',
          ),
          timezone: options?.ageYears?.timezone ?? 'UTC',
        };
      }),
    },
    bodyMeasurement: {
      findFirst: vi.fn(async (args: unknown) => {
        reads.push({ model: 'bodyMeasurement', args });
        if (options?.measurement === false) return null;
        return { weightKg: new Prisma.Decimal(options?.weightKg ?? '60') };
      }),
    },
    onboardingResponses: {
      findUnique: vi.fn(async (args: unknown) => {
        reads.push({ model: 'onboardingResponses', args });
        return { trainingFrequency: options?.frequency ?? '3' };
      }),
    },
    nutritionCalculation: {
      findMany: vi.fn(async (args: unknown) => {
        reads.push({ model: 'nutritionCalculation', args });
        return [];
      }),
    },
    $transaction: vi.fn(async (work: (db: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };

  return {
    service: new NutritionService(prisma as never),
    prisma,
    tx,
    created,
    targetUpdates,
    targetCreates,
    reads,
  };
}

describe('NutritionService', () => {
  it('stores the first calculation and makes it the active target', async () => {
    const { service, created, targetCreates, tx } = harness();

    const result = await service.calculate(userId, now);

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(result.activatedTarget).toBe(true);
    expect(result.bmr).toBe('1320.25');
    expect(result.targetCalories).toBe('1739.429375');
    expect(result.carbsGrams).toBe('193.35734375');
    expect(created[0]?.data.userId).toBe(userId);
    expect(targetCreates[0]?.data).toMatchObject({
      userId,
      active: true,
      source: 'CALCULATED',
      calculationId: 'calc-1',
    });
    expect(
      (targetCreates[0]?.data.targetCalories as Prisma.Decimal).equals(
        '1739.429375',
      ),
    ).toBe(true);
  });

  it('replaces an active calculated target and keeps its numbers untouched', async () => {
    const { service, targetUpdates, targetCreates } = harness({
      active: { id: 'old-target', source: 'CALCULATED' },
    });

    const result = await service.calculate(userId, now);

    expect(result.activatedTarget).toBe(true);
    expect(targetUpdates).toEqual([
      { where: { id: 'old-target' }, data: { active: false } },
    ]);
    expect(targetCreates).toHaveLength(1);
  });

  it('keeps an active manual target when a new calculation is stored', async () => {
    const { service, created, targetUpdates, targetCreates } = harness({
      active: { id: 'manual-target', source: 'MANUAL' },
    });

    const result = await service.calculate(userId, now);

    expect(result.activatedTarget).toBe(false);
    expect(created).toHaveLength(1);
    expect(targetUpdates).toEqual([]);
    expect(targetCreates).toEqual([]);
  });

  it('stores a non-positive carbohydrate result', async () => {
    const { service, created } = harness({
      weightKg: '40',
      heightCm: '100',
      activity: 'SEDENTARY',
      frequency: '2',
      ageYears: { dob: '1936-11-01T00:00:00.000Z', timezone: 'UTC' },
    });

    const result = await service.calculate(userId, now);

    expect(result.carbsNonPositive).toBe(true);
    expect(result.carbsGrams).toBe('-42.23375');
    expect(created[0]?.data.carbsNonPositive).toBe(true);
  });

  it('counts age in the profile timezone', async () => {
    const { service } = harness({
      ageYears: { dob: '1996-11-02T00:00:00.000Z', timezone: 'Europe/Kyiv' },
    });

    const before = await service.calculate(
      userId,
      new Date('2026-11-01T21:30:00.000Z'),
    );
    const after = await service.calculate(
      userId,
      new Date('2026-11-01T22:30:00.000Z'),
    );

    expect(before.ageYears).toBe(29);
    expect(after.ageYears).toBe(30);
  });

  it('writes nothing when weight or frequency cannot be used', async () => {
    const missingWeight = harness({ measurement: false });
    await expect(missingWeight.service.calculate(userId, now)).rejects.toThrow(
      BadRequestException,
    );
    expect(missingWeight.prisma.$transaction).not.toHaveBeenCalled();

    const badFrequency = harness({ frequency: '5' });
    await expect(badFrequency.service.calculate(userId, now)).rejects.toThrow(
      BadRequestException,
    );
    expect(badFrequency.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reads and writes only the caller', async () => {
    const { service, reads, created } = harness();

    await service.calculate(userId, now);
    await service.listCalculations(userId);

    for (const read of reads) {
      expect(JSON.stringify(read.args)).toContain(userId);
    }
    expect(created.every((row) => row.data.userId === userId)).toBe(true);
  });

  it('rejects a coach account before reading nutrition rows', async () => {
    const { service, prisma } = harness({ role: 'ADMIN' });

    await expect(service.calculate(userId, now)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.nutritionProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a profile that uses a training activity or goal', () => {
    const valid = {
      activity: 'MODERATE',
      goal: 'LOSE_WEIGHT',
      mealCount: 4,
    };
    expect(nutritionProfileSchema.parse(valid)).toMatchObject({
      preferences: null,
      allergies: null,
      dislikes: null,
    });
    expect(
      nutritionProfileSchema.safeParse({ ...valid, activity: 'LIGHTLY_ACTIVE' })
        .success,
    ).toBe(false);
    expect(
      nutritionProfileSchema.safeParse({ ...valid, goal: 'MAINTAIN_WEIGHT' })
        .success,
    ).toBe(false);
    expect(
      nutritionProfileSchema.safeParse({ ...valid, goal: 'improve_body' })
        .success,
    ).toBe(false);
    expect(
      nutritionProfileSchema.safeParse({ ...valid, mealCount: 0 }).success,
    ).toBe(false);
    expect(
      nutritionProfileSchema.safeParse({ ...valid, userId: 'someone-else' })
        .success,
    ).toBe(false);
  });
});
