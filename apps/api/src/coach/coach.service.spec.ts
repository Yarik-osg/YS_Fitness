import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { activeAccessWhere } from '../subscriptions/subscription-access.js';
import { CoachService } from './coach.service.js';

describe('CoachService.listClients', () => {
  it('lists clients only and treats missing profile, program, and access as empty', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'client-1',
        email: 'olena@example.com',
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
        profile: {
          name: 'Olena',
          onboardingCompletedAt: new Date('2026-03-05T00:00:00.000Z'),
        },
        workoutProgram: { id: 'program-1' },
        subscriptions: [{ id: 'sub-1' }],
      },
      {
        id: 'client-2',
        email: 'bare@example.com',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        profile: null,
        workoutProgram: null,
        subscriptions: [],
      },
    ]);
    const service = new CoachService({ user: { findMany } } as never);

    const result = await service.listClients();

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0]?.[0];
    expect(query.where).toEqual({ role: UserRole.CLIENT });
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(query.select.subscriptions.where).toEqual(
      activeAccessWhere(query.select.subscriptions.where.currentPeriodEnd.gt),
    );
    expect(result.clients).toEqual([
      {
        id: 'client-1',
        email: 'olena@example.com',
        name: 'Olena',
        createdAt: '2026-03-04T00:00:00.000Z',
        onboardingCompleted: true,
        programAssigned: true,
        subscriptionActive: true,
      },
      {
        id: 'client-2',
        email: 'bare@example.com',
        name: null,
        createdAt: '2026-01-02T00:00:00.000Z',
        onboardingCompleted: false,
        programAssigned: false,
        subscriptionActive: false,
      },
    ]);
  });
});

describe('CoachService.getClient', () => {
  it('returns the saved client detail and treats a missing client as not found', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'client-1',
        email: 'olena@example.com',
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
        profile: {
          name: 'Olena',
          dateOfBirth: new Date('1994-04-12T00:00:00.000Z'),
          biologicalSexForCalculation: 'FEMALE',
          heightCm: { toNumber: () => 168 },
          activityLevel: 'MODERATELY_ACTIVE',
          goal: 'MAINTAIN_WEIGHT',
          timezone: 'Europe/Kyiv',
          onboardingCompletedAt: new Date('2026-03-05T00:00:00.000Z'),
        },
        onboardingResponses: {
          programTrack: 'FEMALE',
          currentBody: '2',
          desiredBody: '4',
          mainGoal: 'MAINTAIN',
          experience: 'BEGINNER',
          trainingFrequency: '3',
          focusAreas: ['glutes'],
          nutritionCurrent: 'BALANCED',
          mealsPerDay: '3',
          eatingHabits: [],
          physiqueLevel: null,
          createdAt: new Date('2026-03-05T00:00:00.000Z'),
          updatedAt: new Date('2026-03-05T00:00:00.000Z'),
        },
        workoutProgram: {
          assignedAt: new Date('2026-03-06T00:00:00.000Z'),
          template: {
            code: 'WB2U',
            name: 'Upper subtitle',
            gender: 'FEMALE',
            level: 'BEGINNER',
            frequencyPerWeek: 2,
            accent: 'UPPER',
          },
        },
        subscriptions: [
          {
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
            plan: { name: 'Basic' },
          },
        ],
      })
      .mockResolvedValueOnce(null);
    const service = new CoachService({ user: { findFirst } } as never);

    const detail = await service.getClient(
      '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10',
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10',
          role: UserRole.CLIENT,
        },
      }),
    );
    const onboardingSelect =
      findFirst.mock.calls[0][0].select.onboardingResponses.select;
    expect(onboardingSelect.programTrack).toBe(true);
    expect(onboardingSelect.id).toBeUndefined();
    expect(onboardingSelect.userId).toBeUndefined();
    expect(detail.onboarding?.mainGoal).toBe('maintain');
    expect(detail.program).toMatchObject({
      accent: 'UPPER',
      templateCode: 'WB2U',
      level: 'beginner',
      gender: 'female',
    });
    expect(detail.subscription).toMatchObject({
      active: false,
      status: 'ACTIVE',
      planName: 'Basic',
    });
    expect(detail.profile?.heightCm).toBe(168);
    expect(detail.profile?.dateOfBirth).toBe('1994-04-12');

    await expect(service.getClient('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
