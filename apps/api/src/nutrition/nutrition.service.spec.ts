import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, type NutritionCalculation } from '@prisma/client';
import { nutritionProfileSchema } from '@repo/validation';
import { describe, expect, it, vi } from 'vitest';
import { NutritionService } from './nutrition.service.js';

const now = new Date('2026-11-01T12:00:00.000Z');
const userId = 'user-b';

function storedCalculation(weightKg: string): NutritionCalculation {
  return {
    id: 'calc-old',
    userId,
    weightKg: new Prisma.Decimal(weightKg),
    heightCm: new Prisma.Decimal('165'),
    ageYears: 30,
    sex: 'FEMALE',
    activity: 'MODERATE',
    frequency: 3,
    goal: 'LOSE_WEIGHT',
    activityMultiplier: new Prisma.Decimal('1.55'),
    goalAdjustment: new Prisma.Decimal('-0.2'),
    bmr: new Prisma.Decimal('1300'),
    tdee: new Prisma.Decimal('2000'),
    targetCalories: new Prisma.Decimal('1700'),
    proteinGrams: new Prisma.Decimal('100'),
    fatGrams: new Prisma.Decimal('50'),
    carbsGrams: new Prisma.Decimal('150'),
    carbsNonPositive: false,
    createdAt: now,
  };
}

function harness(options?: {
  role?: 'CLIENT' | 'ADMIN';
  profile?: boolean;
  measurement?: boolean;
  frequency?: string;
  active?: { id: string; source: 'CALCULATED' | 'MANUAL' } | null;
  locked?: boolean;
  ageYears?: { dob: string; timezone: string };
  weightKg?: string;
  /** Weight visible after the user row lock. Differs when a later save won the race. */
  lockedWeightKg?: string;
  /** Height visible after the user row lock. */
  lockedHeightCm?: string;
  heightCm?: string;
  activity?: 'SEDENTARY' | 'MODERATE';
  goal?: 'LOSE_WEIGHT' | 'MAINTAIN';
  activityLevel?:
    | 'SEDENTARY'
    | 'LIGHTLY_ACTIVE'
    | 'MODERATELY_ACTIVE'
    | 'VERY_ACTIVE'
    | 'EXTRA_ACTIVE';
  trainingGoal?: 'LOSE_WEIGHT' | 'MAINTAIN_WEIGHT' | 'GAIN_WEIGHT';
  mealsPerDay?: string;
  mainGoal?: string;
  racedCalculation?: NutritionCalculation | null;
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
  const profileCreates: { data: Record<string, unknown> }[] = [];
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
    nutritionProfile: {
      findUnique: vi.fn(async () => profile),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        profileCreates.push(args);
        return { id: 'profile-1', ...args.data };
      }),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        profileCreates.push(args);
        return args.data;
      }),
    },
    userProfile: {
      findUnique: vi.fn(async () => ({
        biologicalSexForCalculation: 'FEMALE',
        heightCm: new Prisma.Decimal(
          options?.lockedHeightCm ?? options?.heightCm ?? '165',
        ),
        activityLevel: options?.activityLevel ?? 'MODERATELY_ACTIVE',
        goal: options?.trainingGoal ?? 'LOSE_WEIGHT',
        dateOfBirth: new Date(
          options?.ageYears?.dob ?? '1996-11-01T00:00:00.000Z',
        ),
        timezone: options?.ageYears?.timezone ?? 'UTC',
      })),
    },
    onboardingResponses: {
      findUnique: vi.fn(async () => ({
        trainingFrequency: options?.frequency ?? '3',
        mealsPerDay: options?.mealsPerDay ?? '3',
        mainGoal: options?.mainGoal,
      })),
    },
    bodyMeasurement: {
      findFirst: vi.fn(async () => {
        if (options?.measurement === false) return null;
        return {
          weightKg: new Prisma.Decimal(
            options?.lockedWeightKg ?? options?.weightKg ?? '60',
          ),
        };
      }),
    },
    nutritionCalculation: {
      findFirst: vi.fn(async () => options?.racedCalculation ?? null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args);
        return {
          id: 'calc-1',
          createdAt: now,
          ...args.data,
        };
      }),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args);
        return {
          id: options?.racedCalculation?.id ?? 'calc-1',
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
          activityLevel: options?.activityLevel ?? 'MODERATELY_ACTIVE',
          goal: options?.trainingGoal ?? 'LOSE_WEIGHT',
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
        return {
          trainingFrequency: options?.frequency ?? '3',
          mealsPerDay: options?.mealsPerDay ?? '3',
          mainGoal: options?.mainGoal,
        };
      }),
    },
    nutritionCalculation: {
      findMany: vi.fn(async (args: unknown) => {
        reads.push({ model: 'nutritionCalculation', args });
        return [];
      }),
    },
    nutritionTarget: {
      findFirst: vi.fn(async (args: unknown) => {
        reads.push({ model: 'nutritionTarget', args });
        return null;
      }),
    },
    $transaction: vi.fn(async (work: (db: typeof tx) => Promise<unknown>) => {
      const mark = {
        created: created.length,
        targetUpdates: targetUpdates.length,
        targetCreates: targetCreates.length,
        profileCreates: profileCreates.length,
      };
      try {
        return await work(tx);
      } catch (error) {
        created.length = mark.created;
        targetUpdates.length = mark.targetUpdates;
        targetCreates.length = mark.targetCreates;
        profileCreates.length = mark.profileCreates;
        throw error;
      }
    }),
  };

  return {
    service: new NutritionService(prisma as never),
    prisma,
    tx,
    created,
    targetUpdates,
    targetCreates,
    profileCreates,
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
    expect(result.carbsGrams).toBe('181.35734375');
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

  it('returns the stored calculation instead of saving another', async () => {
    const racedCalculation = {
      id: 'calc-existing',
      userId,
      createdAt: now,
      weightKg: new Prisma.Decimal('60'),
      heightCm: new Prisma.Decimal('165'),
      ageYears: 30,
      sex: 'FEMALE',
      activity: 'MODERATE',
      frequency: 3,
      goal: 'LOSE_WEIGHT',
      activityMultiplier: new Prisma.Decimal('1.55'),
      goalAdjustment: new Prisma.Decimal('-0.15'),
      bmr: new Prisma.Decimal('1320.25'),
      tdee: new Prisma.Decimal('2046.3875'),
      targetCalories: new Prisma.Decimal('1739.429375'),
      proteinGrams: new Prisma.Decimal('120'),
      fatGrams: new Prisma.Decimal('54'),
      carbsGrams: new Prisma.Decimal('193.35734375'),
      carbsNonPositive: false,
    } as NutritionCalculation;
    const { service, created, targetCreates } = harness({ racedCalculation });

    const result = await service.calculate(userId, now);

    expect(created).toHaveLength(0);
    expect(targetCreates).toHaveLength(0);
    expect(result).toMatchObject({
      id: 'calc-existing',
      activatedTarget: false,
      targetCalories: '1739.429375',
    });
  });

  it('appends a calculation and a calculated target without changing the old rows', async () => {
    const stored = storedCalculation('60');
    const {
      service,
      created,
      targetUpdates,
      targetCreates,
      profileCreates,
      tx,
    } = harness({
      racedCalculation: stored,
      active: { id: 'old-target', source: 'CALCULATED' },
      mainGoal: 'BUILD_MUSCLE',
    });

    await service.replaceFromProfile(userId, now);

    expect(tx.nutritionCalculation.update).not.toHaveBeenCalled();
    expect(stored.targetCalories.toString()).toBe('1700');
    expect(stored.goal).toBe('LOSE_WEIGHT');
    expect(created).toHaveLength(1);
    expect(created[0]?.data).toMatchObject({
      activity: 'HIGH',
      frequency: 3,
      goal: 'GAIN_MUSCLE',
      heightCm: new Prisma.Decimal('165'),
    });
    expect(profileCreates[0]?.data).toMatchObject({
      activity: 'HIGH',
      goal: 'GAIN_MUSCLE',
    });
    expect(targetUpdates).toEqual([
      { where: { id: 'old-target' }, data: { active: false } },
    ]);
    expect(targetCreates[0]?.data).toMatchObject({
      source: 'CALCULATED',
      active: true,
      calculationId: 'calc-1',
    });
  });

  it('keeps the same manual target while storing a new calculation', async () => {
    const stored = storedCalculation('60');
    const { service, created, targetUpdates, targetCreates, tx } = harness({
      racedCalculation: stored,
      active: { id: 'manual-target', source: 'MANUAL' },
      mainGoal: 'IMPROVE_BODY',
    });

    await service.replaceFromProfile(userId, now);

    expect(created).toHaveLength(1);
    expect(created[0]?.data.goal).toBe('RECOMPOSITION');
    expect(tx.nutritionCalculation.update).not.toHaveBeenCalled();
    expect(targetUpdates).toEqual([]);
    expect(targetCreates).toEqual([]);
    expect(stored.targetCalories.toString()).toBe('1700');
  });

  it('creates a calculated target when none is active', async () => {
    const { service, targetUpdates, targetCreates } = harness({
      active: null,
      mainGoal: 'MAINTAIN',
    });

    await service.replaceFromProfile(userId, now);

    expect(targetUpdates).toEqual([]);
    expect(targetCreates).toHaveLength(1);
    expect(targetCreates[0]?.data).toMatchObject({
      active: true,
      source: 'CALCULATED',
      calculationId: 'calc-1',
    });
  });

  it('reads nutrition inputs only after the client row is locked', async () => {
    const { service, tx, created } = harness({
      heightCm: '165',
      lockedHeightCm: '180',
      mainGoal: 'LOSE_WEIGHT',
    });

    await service.replaceFromProfile(userId, now);

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.userProfile.findUnique.mock.invocationCallOrder[0] ?? 0,
    );
    expect(created[0]?.data.heightCm).toEqual(new Prisma.Decimal('180'));
  });

  it('leaves no active-target change when the new target cannot be stored', async () => {
    const { service, tx, targetUpdates, targetCreates, created } = harness({
      racedCalculation: storedCalculation('60'),
      active: { id: 'old-target', source: 'CALCULATED' },
      mainGoal: 'BUILD_MUSCLE',
    });
    tx.nutritionTarget.create.mockRejectedValueOnce(new Error('db'));

    await expect(service.replaceFromProfile(userId, now)).rejects.toThrow('db');
    expect(created).toEqual([]);
    expect(targetUpdates).toEqual([]);
    expect(targetCreates).toEqual([]);
  });

  it('lets a second recalculation wait until the first releases the lock', async () => {
    const h = harness({
      racedCalculation: storedCalculation('60'),
      active: { id: 'old-target', source: 'CALCULATED' },
      mainGoal: 'MAINTAIN',
    });
    let held = false;
    const waiting: (() => void)[] = [];
    const events: string[] = [];
    let active: { id: string; source: 'CALCULATED' } | null = {
      id: 'old-target',
      source: 'CALCULATED',
    };
    h.tx.$queryRaw.mockImplementation(async () => {
      if (held) await new Promise<void>((resolve) => waiting.push(resolve));
      held = true;
      return [{ id: userId }];
    });
    h.prisma.$transaction.mockImplementation(async (work) => {
      try {
        return await work(h.tx);
      } finally {
        held = false;
        waiting.shift()?.();
      }
    });
    h.tx.nutritionTarget.findFirst.mockImplementation(async () => active);
    h.tx.nutritionTarget.update.mockImplementation(async (args) => {
      events.push('deactivate');
      active = null;
      h.targetUpdates.push(args);
      return args;
    });
    h.tx.nutritionTarget.create.mockImplementation(async (args) => {
      events.push('create');
      active = {
        id: `target-${h.targetCreates.length + 1}`,
        source: 'CALCULATED',
      };
      h.targetCreates.push(args);
      return { id: active.id, ...args.data };
    });

    await Promise.all([
      h.service.replaceFromProfile(userId, now),
      h.service.replaceFromProfile(userId, now),
    ]);

    expect(events).toEqual(['deactivate', 'create', 'deactivate', 'create']);
    expect(h.tx.nutritionCalculation.update).not.toHaveBeenCalled();
    expect(h.created).toHaveLength(2);
    expect(h.targetUpdates).toEqual([
      { where: { id: 'old-target' }, data: { active: false } },
      { where: { id: 'target-1' }, data: { active: false } },
    ]);
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

  it('derives the first profile from onboarding when none is saved', async () => {
    const { service, profileCreates, created } = harness({
      profile: false,
      activityLevel: 'LIGHTLY_ACTIVE',
      trainingGoal: 'GAIN_WEIGHT',
      mealsPerDay: '4-5',
    });

    const result = await service.calculate(userId, now);

    expect(profileCreates[0]?.data).toMatchObject({
      userId,
      activity: 'MODERATE',
      goal: 'GAIN_MUSCLE',
      mealCount: 4,
    });
    expect(created[0]?.data.activity).toBe('MODERATE');
    expect(created[0]?.data.goal).toBe('GAIN_MUSCLE');
    expect(result.activatedTarget).toBe(true);
  });

  it('stores a manual target and leaves the calculation rows alone', async () => {
    const { service, created, targetUpdates, targetCreates } = harness({
      active: { id: 'calc-target', source: 'CALCULATED' },
    });

    const result = await service.setManualTarget(userId, {
      targetCalories: '1800',
      proteinGrams: '130',
      fatGrams: '50',
      carbsGrams: '180.5',
    });

    expect(created).toHaveLength(0);
    expect(targetUpdates).toEqual([
      { where: { id: 'calc-target' }, data: { active: false } },
    ]);
    expect(targetCreates[0]?.data).toMatchObject({
      userId,
      active: true,
      source: 'MANUAL',
      calculationId: null,
    });
    expect(result).toMatchObject({
      source: 'MANUAL',
      calculationId: null,
      targetCalories: '1800',
      carbsGrams: '180.5',
    });
  });

  it('applies a stored calculation without changing that snapshot', async () => {
    const { service, tx, targetUpdates, targetCreates } = harness({
      active: { id: 'manual-target', source: 'MANUAL' },
      racedCalculation: {
        id: 'calc-9',
        userId,
        targetCalories: new Prisma.Decimal('1739.429375'),
        proteinGrams: new Prisma.Decimal('120'),
        fatGrams: new Prisma.Decimal('54'),
        carbsGrams: new Prisma.Decimal('193.35734375'),
      } as NutritionCalculation,
    });

    const result = await service.applyCalculation(userId, 'calc-9');

    expect(tx.nutritionCalculation.create).not.toHaveBeenCalled();
    expect(targetUpdates).toEqual([
      { where: { id: 'manual-target' }, data: { active: false } },
    ]);
    expect(targetCreates[0]?.data).toMatchObject({
      source: 'CALCULATED',
      calculationId: 'calc-9',
      active: true,
    });
    expect(result.targetCalories).toBe('1739.429375');
  });

  it('keeps the stored calculation until weight has moved 5 kg', async () => {
    const stored = storedCalculation('60');
    const short = harness({
      weightKg: '64.99',
      active: { id: 'calc-target', source: 'CALCULATED' },
      racedCalculation: stored,
    });

    const unchanged = await short.service.calculate(userId, now);

    expect(unchanged.id).toBe('calc-old');
    expect(unchanged.activatedTarget).toBe(false);
    expect(short.created).toHaveLength(0);
    expect(short.targetCreates).toEqual([]);

    const shifted = harness({
      weightKg: '65',
      active: { id: 'calc-target', source: 'CALCULATED' },
      racedCalculation: stored,
    });

    const updated = await shifted.service.calculate(userId, now);

    expect(updated.activatedTarget).toBe(true);
    expect(updated.weightKg).toBe('65');
    expect(shifted.created).toHaveLength(1);
    expect(shifted.targetUpdates).toEqual([
      { where: { id: 'calc-target' }, data: { active: false } },
    ]);
    expect(shifted.targetCreates[0]?.data).toMatchObject({
      source: 'CALCULATED',
      active: true,
    });

    const fallen = harness({
      weightKg: '55',
      active: { id: 'calc-target', source: 'CALCULATED' },
      racedCalculation: stored,
    });
    const lost = await fallen.service.calculate(userId, now);
    expect(lost.weightKg).toBe('55');
    expect(fallen.created).toHaveLength(1);
  });

  it('uses the weight read after the user row is locked', async () => {
    const { service, created } = harness({
      weightKg: '64.99',
      lockedWeightKg: '65',
      active: { id: 'calc-target', source: 'CALCULATED' },
      racedCalculation: storedCalculation('60'),
    });

    const updated = await service.calculate(userId, now);

    expect(updated.weightKg).toBe('65');
    expect(created).toHaveLength(1);
  });

  it('stores a shifted calculation without replacing an active manual target', async () => {
    const { service, created, targetUpdates, targetCreates } = harness({
      weightKg: '70',
      active: { id: 'manual-target', source: 'MANUAL' },
      racedCalculation: storedCalculation('60'),
    });

    const result = await service.calculate(userId, now);

    expect(result.weightKg).toBe('70');
    expect(result.activatedTarget).toBe(false);
    expect(created).toHaveLength(1);
    expect(targetUpdates).toEqual([]);
    expect(targetCreates).toEqual([]);
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
    expect(result.carbsGrams).toBe('-50.23375');
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

  it('stores nothing when weight or frequency cannot be used', async () => {
    const missingWeight = harness({ measurement: false });
    await expect(missingWeight.service.calculate(userId, now)).rejects.toThrow(
      BadRequestException,
    );
    expect(missingWeight.created).toEqual([]);
    expect(missingWeight.targetCreates).toEqual([]);

    const badFrequency = harness({ frequency: '5' });
    await expect(badFrequency.service.calculate(userId, now)).rejects.toThrow(
      BadRequestException,
    );
    expect(badFrequency.created).toEqual([]);
    expect(badFrequency.targetCreates).toEqual([]);
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

  it('lists each client target and the onboarding inputs the formula uses', async () => {
    const listed = await new NutritionService({
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'with-target',
            email: 'a@example.com',
            isActive: true,
            profile: {
              name: 'Анна',
              dateOfBirth: new Date('1996-11-01T00:00:00.000Z'),
              biologicalSexForCalculation: 'FEMALE',
              heightCm: new Prisma.Decimal('165'),
              activityLevel: 'SEDENTARY',
              goal: 'GAIN_WEIGHT',
              timezone: 'UTC',
            },
            onboardingResponses: { trainingFrequency: '3' },
            nutritionProfile: { activity: 'HIGH', goal: 'RECOMPOSITION' },
            nutritionTargets: [
              {
                source: 'MANUAL',
                targetCalories: new Prisma.Decimal('1800'),
                proteinGrams: new Prisma.Decimal('130'),
                fatGrams: new Prisma.Decimal('50'),
                carbsGrams: new Prisma.Decimal('180.5'),
              },
            ],
            bodyMeasurements: [{ weightKg: new Prisma.Decimal('60.5') }],
          },
          {
            id: 'from-onboarding',
            email: 'b@example.com',
            isActive: false,
            profile: {
              name: null,
              dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
              biologicalSexForCalculation: 'MALE',
              heightCm: new Prisma.Decimal('180'),
              activityLevel: 'MODERATELY_ACTIVE',
              goal: 'LOSE_WEIGHT',
              timezone: 'UTC',
            },
            onboardingResponses: {
              trainingFrequency: '4',
              mainGoal: 'LOSE_WEIGHT',
            },
            nutritionProfile: null,
            nutritionTargets: [],
            bodyMeasurements: [],
          },
          {
            id: 'unsupported-activity',
            email: 'c@example.com',
            isActive: true,
            profile: {
              name: null,
              dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
              biologicalSexForCalculation: 'FEMALE',
              heightCm: new Prisma.Decimal('170'),
              activityLevel: 'EXTRA_ACTIVE',
              goal: 'MAINTAIN_WEIGHT',
              timezone: 'UTC',
            },
            onboardingResponses: {
              trainingFrequency: '2',
              mainGoal: 'MAINTAIN',
            },
            nutritionProfile: null,
            nutritionTargets: [],
            bodyMeasurements: [{ weightKg: new Prisma.Decimal('60') }],
          },
        ]),
      },
    } as never).listRoster(now);

    expect(listed.clients).toEqual([
      {
        id: 'with-target',
        email: 'a@example.com',
        name: 'Анна',
        archived: false,
        target: {
          source: 'MANUAL',
          targetCalories: '1800',
          proteinGrams: '130',
          fatGrams: '50',
          carbsGrams: '180.5',
        },
        inputs: {
          sex: 'FEMALE',
          ageYears: 30,
          heightCm: '165',
          weightKg: '60.5',
          activity: 'HIGH',
          frequency: '3',
          goal: 'RECOMPOSITION',
        },
      },
      {
        id: 'from-onboarding',
        email: 'b@example.com',
        name: null,
        archived: true,
        target: null,
        inputs: {
          sex: 'MALE',
          ageYears: 26,
          heightCm: '180',
          weightKg: null,
          activity: 'HIGH',
          frequency: '4',
          goal: 'LOSE_WEIGHT',
        },
      },
      {
        id: 'unsupported-activity',
        email: 'c@example.com',
        name: null,
        archived: false,
        target: null,
        inputs: {
          sex: 'FEMALE',
          ageYears: 36,
          heightCm: '170',
          weightKg: '60',
          activity: null,
          frequency: '2',
          goal: 'MAINTAIN',
        },
      },
    ]);
  });
});
