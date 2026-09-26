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

function createService(transaction: Record<string, unknown>) {
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback(transaction),
    ),
    onboardingResponses: {
      findUnique: vi.fn(),
    },
  };
  return {
    service: new UsersService(prisma as never),
    prisma,
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
    const service = new UsersService(prisma as never);

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
    const service = new UsersService(prisma as never);

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
