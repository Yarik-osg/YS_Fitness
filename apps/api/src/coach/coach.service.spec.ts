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
