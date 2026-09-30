import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEMALE_ONBOARDING } from '../../test/onboarding.fixture.js';
import { UsersService } from './users.service.js';

const userId = '11111111-1111-4111-8111-111111111111';

const existingResponses = {
  id: '22222222-2222-4222-8222-222222222222',
  userId,
  programTrack: 'FEMALE',
  currentBody: '0',
  desiredBody: '1',
  mainGoal: 'GET_STRONGER',
  experience: 'INTERMEDIATE',
  trainingFrequency: '3',
  focusAreas: ['glutes'],
  nutritionCurrent: 'BALANCED',
  mealsPerDay: '3',
  eatingHabits: ['snacking', 'emotional'],
  physiqueLevel: '4',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService(
  transaction: Record<string, unknown>,
  programs: {
    assign: ReturnType<typeof vi.fn>;
    getAssigned: ReturnType<typeof vi.fn>;
    unassign: ReturnType<typeof vi.fn>;
  } = { assign: vi.fn(), getAssigned: vi.fn(), unassign: vi.fn() },
  subscriptions: { hasActiveAccess: ReturnType<typeof vi.fn> } = {
    hasActiveAccess: vi.fn().mockResolvedValue(true),
  },
) {
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback(transaction),
    ),
    onboardingResponses: {
      findUnique: vi.fn(),
    },
  };
  return {
    service: new UsersService(
      prisma as never,
      programs as never,
      subscriptions as never,
    ),
    prisma,
    programs,
    subscriptions,
  };
}

describe('UsersService.saveOnboarding', () => {
  const userProfile = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };
  const bodyMeasurement = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const onboardingResponses = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };

  beforeEach(() => {
    userProfile.findUnique.mockReset().mockResolvedValue(null);
    userProfile.upsert.mockReset().mockResolvedValue({
      userId,
      onboardingCompletedAt: new Date('2026-09-21T00:00:00.000Z'),
    });
    bodyMeasurement.findFirst.mockReset().mockResolvedValue(null);
    bodyMeasurement.create.mockReset().mockResolvedValue({
      weightKg: new Prisma.Decimal(FEMALE_ONBOARDING.weightKg),
      bodyFatPercent: new Prisma.Decimal(FEMALE_ONBOARDING.bodyFatPercent),
    });
    onboardingResponses.findUnique.mockReset().mockResolvedValue(null);
    onboardingResponses.upsert.mockReset().mockResolvedValue(existingResponses);
  });

  it('does not write OnboardingResponses again when the payload is unchanged', async () => {
    onboardingResponses.findUnique.mockResolvedValue(existingResponses);
    bodyMeasurement.findFirst.mockResolvedValue({
      weightKg: new Prisma.Decimal(FEMALE_ONBOARDING.weightKg),
      bodyFatPercent: new Prisma.Decimal(FEMALE_ONBOARDING.bodyFatPercent),
    });
    const { service } = createService({
      userProfile,
      bodyMeasurement,
      onboardingResponses,
    });

    await service.saveOnboarding(userId, FEMALE_ONBOARDING);

    expect(userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: 'Olena' }),
        update: expect.objectContaining({ name: 'Olena' }),
      }),
    );
    expect(onboardingResponses.upsert).not.toHaveBeenCalled();
    expect(bodyMeasurement.create).not.toHaveBeenCalled();
  });

  it('rejects when the OnboardingResponses write fails so the transaction can roll back', async () => {
    onboardingResponses.upsert.mockRejectedValue(new Error('write failed'));
    const { service } = createService({
      userProfile,
      bodyMeasurement,
      onboardingResponses,
    });

    await expect(
      service.saveOnboarding(userId, FEMALE_ONBOARDING),
    ).rejects.toThrow('write failed');
    expect(userProfile.upsert).toHaveBeenCalled();
  });
});

describe('UsersService.getOnboardingResponses', () => {
  it('returns null when the caller has no stored questionnaire', async () => {
    const prisma = {
      $transaction: vi.fn(),
      onboardingResponses: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new UsersService(
      prisma as never,
      { assign: vi.fn(), getMine: vi.fn() } as never,
      { hasActiveAccess: vi.fn() } as never,
    );

    await expect(service.getOnboardingResponses(userId)).resolves.toEqual({
      responses: null,
    });
  });

  it('maps a stored row back to the submitted wire values', async () => {
    const prisma = {
      $transaction: vi.fn(),
      onboardingResponses: {
        findUnique: vi.fn().mockResolvedValue(existingResponses),
      },
    };
    const service = new UsersService(
      prisma as never,
      { assign: vi.fn(), getMine: vi.fn() } as never,
      { hasActiveAccess: vi.fn() } as never,
    );

    await expect(service.getOnboardingResponses(userId)).resolves.toEqual({
      responses: {
        programTrack: 'female',
        currentBody: '0',
        desiredBody: '1',
        mainGoal: 'get_stronger',
        experience: 'intermediate',
        trainingFrequency: '3',
        focusAreas: ['glutes'],
        nutritionCurrent: 'balanced',
        mealsPerDay: '3',
        eatingHabits: ['snacking', 'emotional'],
        physiqueLevel: '4',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
  });
});

const assignedProgram = {
  id: 'program-1',
  templateCode: 'WM3',
  templateName:
    'WM3 — Жінки · Середній рівень · 3 тренування на тиждень · Без акценту',
};

describe('UsersService.updateProfile', () => {
  const userProfile = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const bodyMeasurement = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const onboardingResponses = {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };

  const storedProfile = {
    heightCm: new Prisma.Decimal(168),
    dateOfBirth: new Date('1998-03-15T00:00:00.000Z'),
    biologicalSexForCalculation: 'FEMALE',
    goal: 'LOSE_WEIGHT',
    activityLevel: 'MODERATELY_ACTIVE',
  };

  beforeEach(() => {
    userProfile.findUnique.mockReset().mockResolvedValue(storedProfile);
    userProfile.update.mockReset().mockResolvedValue(storedProfile);
    bodyMeasurement.findFirst.mockReset().mockResolvedValue({
      weightKg: new Prisma.Decimal(58),
      bodyFatPercent: new Prisma.Decimal(22),
    });
    bodyMeasurement.create.mockReset().mockResolvedValue({});
    onboardingResponses.findUnique
      .mockReset()
      .mockResolvedValue(existingResponses);
    onboardingResponses.update.mockReset().mockResolvedValue(existingResponses);
    onboardingResponses.create.mockReset().mockResolvedValue(existingResponses);
  });

  function serviceWithAssign() {
    const programs = {
      assign: vi.fn().mockResolvedValue(assignedProgram),
      getAssigned: vi.fn().mockResolvedValue({ program: assignedProgram }),
      unassign: vi.fn(),
    };
    const created = createService(
      { userProfile, bodyMeasurement, onboardingResponses },
      programs,
    );
    return { ...created, programs };
  }

  it('updates only the editable fields, appends a changed weight, and reassigns', async () => {
    const { service, programs } = serviceWithAssign();

    const result = await service.updateProfile(userId, {
      heightCm: 170,
      weightKg: 60,
      experience: 'advanced',
      mainGoal: 'lose_weight',
      trainingFrequency: '4',
    });

    expect(userProfile.update).toHaveBeenCalledWith({
      where: { userId },
      data: { heightCm: 170 },
    });
    expect(onboardingResponses.update).toHaveBeenCalledWith({
      where: { userId },
      data: {
        experience: 'ADVANCED',
        mainGoal: 'LOSE_WEIGHT',
        trainingFrequency: '4',
      },
    });
    expect(bodyMeasurement.create).toHaveBeenCalledWith({
      data: {
        userId,
        weightKg: 60,
        bodyFatPercent: new Prisma.Decimal(22),
      },
    });
    expect(programs.assign).toHaveBeenCalledWith(
      userId,
      { userProfile, bodyMeasurement, onboardingResponses },
      { preserveAssignedAt: true },
    );
    expect(result.program).toEqual(assignedProgram);
    expect(result).toMatchObject({
      heightCm: 170,
      weightKg: 60,
      experience: 'advanced',
      mainGoal: 'lose_weight',
      trainingFrequency: '4',
    });
  });

  it('does not append a measurement when the weight is unchanged', async () => {
    const { service, programs } = serviceWithAssign();

    await service.updateProfile(userId, { weightKg: 58 });

    expect(bodyMeasurement.create).not.toHaveBeenCalled();
    expect(userProfile.update).not.toHaveBeenCalled();
    expect(onboardingResponses.update).not.toHaveBeenCalled();
    expect(programs.assign).not.toHaveBeenCalled();
  });

  it('leaves onboarding-only fields untouched when only height changes', async () => {
    const { service, programs } = serviceWithAssign();

    await service.updateProfile(userId, { heightCm: 172 });

    expect(userProfile.update).toHaveBeenCalledTimes(1);
    expect(userProfile.update.mock.calls[0]?.[0].data).toEqual({
      heightCm: 172,
    });
    expect(onboardingResponses.update).not.toHaveBeenCalled();
    expect(bodyMeasurement.create).not.toHaveBeenCalled();
    expect(programs.assign).not.toHaveBeenCalled();
    expect(programs.unassign).not.toHaveBeenCalled();
  });

  it('does not reassign when submitted training answers match the stored row', async () => {
    const { service, programs } = serviceWithAssign();

    await service.updateProfile(userId, {
      heightCm: 172,
      experience: 'intermediate',
      mainGoal: 'get_stronger',
      trainingFrequency: '3',
    });

    expect(programs.assign).not.toHaveBeenCalled();
    expect(programs.unassign).not.toHaveBeenCalled();
  });

  it('keeps a height-only save when no program is assigned', async () => {
    const programs = {
      assign: vi.fn().mockRejectedValue(
        new NotFoundException({
          code: 'PROGRAM_NOT_AVAILABLE',
          message: 'No program is available for this track yet',
        }),
      ),
      getAssigned: vi.fn().mockResolvedValue({ program: null }),
      unassign: vi.fn(),
    };
    const { service } = createService(
      { userProfile, bodyMeasurement, onboardingResponses },
      programs,
    );

    const result = await service.updateProfile(userId, { heightCm: 172 });

    expect(userProfile.update).toHaveBeenCalledWith({
      where: { userId },
      data: { heightCm: 172 },
    });
    expect(programs.assign).not.toHaveBeenCalled();
    expect(programs.unassign).not.toHaveBeenCalled();
    expect(result.program).toBeNull();
    expect(result.heightCm).toBe(172);
  });

  it('keeps the assigned program on a height-only save even if no template matches', async () => {
    const programs = {
      assign: vi.fn().mockRejectedValue(
        new NotFoundException({
          code: 'PROGRAM_NOT_AVAILABLE',
          message: 'No program is available for this track yet',
        }),
      ),
      getAssigned: vi.fn().mockResolvedValue({ program: assignedProgram }),
      unassign: vi.fn(),
    };
    const { service } = createService(
      { userProfile, bodyMeasurement, onboardingResponses },
      programs,
    );

    const result = await service.updateProfile(userId, { heightCm: 172 });

    expect(programs.assign).not.toHaveBeenCalled();
    expect(programs.unassign).not.toHaveBeenCalled();
    expect(result.program).toEqual(assignedProgram);
  });

  it('clears a stale program when the updated answers match no template', async () => {
    const programs = {
      assign: vi.fn().mockRejectedValue(
        new NotFoundException({
          code: 'PROGRAM_NOT_AVAILABLE',
          message: 'No program is available for this track yet',
        }),
      ),
      getAssigned: vi.fn().mockResolvedValue({ program: assignedProgram }),
      unassign: vi.fn(),
    };
    const { service } = createService(
      { userProfile, bodyMeasurement, onboardingResponses },
      programs,
    );

    const result = await service.updateProfile(userId, {
      experience: 'beginner',
    });

    expect(programs.assign).toHaveBeenCalled();
    expect(programs.unassign).toHaveBeenCalled();
    expect(result.program).toBeNull();
  });

  it('does not assign a program when the caller has no active subscription', async () => {
    const programs = {
      assign: vi.fn(),
      getAssigned: vi.fn().mockResolvedValue({ program: assignedProgram }),
      unassign: vi.fn(),
    };
    const subscriptions = {
      hasActiveAccess: vi.fn().mockResolvedValue(false),
    };
    const { service } = createService(
      { userProfile, bodyMeasurement, onboardingResponses },
      programs,
      subscriptions,
    );

    const result = await service.updateProfile(userId, { heightCm: 172 });

    expect(programs.assign).not.toHaveBeenCalled();
    expect(programs.getAssigned).not.toHaveBeenCalled();
    expect(result.program).toBeNull();
    expect(result.heightCm).toBe(172);
  });

  it('saves height and weight when onboarding answers are missing', async () => {
    onboardingResponses.findUnique.mockResolvedValue(null);
    const { service, programs } = serviceWithAssign();

    const result = await service.updateProfile(userId, {
      heightCm: 183,
      weightKg: 85,
    });

    expect(onboardingResponses.create).not.toHaveBeenCalled();
    expect(onboardingResponses.update).not.toHaveBeenCalled();
    expect(programs.assign).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      heightCm: 183,
      weightKg: 85,
      experience: null,
      mainGoal: null,
      trainingFrequency: null,
    });
  });

  it('creates onboarding answers from the first profile edit', async () => {
    onboardingResponses.findUnique.mockResolvedValue(null);
    const { service, programs } = serviceWithAssign();

    const result = await service.updateProfile(userId, {
      heightCm: 183,
      weightKg: 85,
      experience: 'beginner',
      mainGoal: 'get_stronger',
      trainingFrequency: '3',
    });

    expect(onboardingResponses.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        programTrack: 'FEMALE',
        experience: 'BEGINNER',
        mainGoal: 'GET_STRONGER',
        trainingFrequency: '3',
        focusAreas: [],
      }),
    });
    expect(result.experience).toBe('beginner');
    expect(result.mainGoal).toBe('get_stronger');
    expect(result.trainingFrequency).toBe('3');
    expect(programs.assign).not.toHaveBeenCalled();
  });

  it('does not assign from a stub questionnaire with no focus area', async () => {
    onboardingResponses.findUnique.mockResolvedValue({
      ...existingResponses,
      focusAreas: [],
    });
    const { service, programs } = serviceWithAssign();

    const result = await service.updateProfile(userId, {
      experience: 'beginner',
    });

    expect(programs.assign).not.toHaveBeenCalled();
    expect(programs.unassign).not.toHaveBeenCalled();
    expect(result.program).toEqual(assignedProgram);
  });
});
