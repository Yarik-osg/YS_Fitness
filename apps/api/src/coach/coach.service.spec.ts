import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CoachService } from './coach.service.js';

function createService(
  prisma: unknown,
  users: unknown = {},
  workouts: unknown = {},
  programs: unknown = {},
  mail: unknown = { sendProgramAssigned: vi.fn() },
) {
  return new CoachService(
    prisma as never,
    users as never,
    workouts as never,
    programs as never,
    mail as never,
  );
}

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
        workoutProgram: { template: { name: 'Upper split' } },
        subscriptions: [
          {
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
          },
        ],
      },
      {
        id: 'client-2',
        email: 'bare@example.com',
        isActive: true,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        profile: null,
        workoutProgram: null,
        subscriptions: [],
      },
    ]);
    const groupBy = vi.fn().mockResolvedValue([
      {
        userId: 'client-1',
        _max: { completedAt: new Date('2026-04-02T00:00:00.000Z') },
      },
    ]);
    const service = createService({
      user: { findMany },
      workoutLog: { groupBy },
    });

    const result = await service.listClients();

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0]?.[0];
    expect(query.where).toEqual({ role: UserRole.CLIENT });
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(query.select.workoutProgram).toEqual({
      select: { template: { select: { name: true } } },
    });
    expect(query.select.subscriptions).toEqual({
      select: { status: true, currentPeriodEnd: true },
    });
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['userId'],
      where: { userId: { in: ['client-1', 'client-2'] } },
      _max: { completedAt: true },
    });
    expect(result.clients).toEqual([
      {
        id: 'client-1',
        email: 'olena@example.com',
        name: 'Olena',
        createdAt: '2026-03-04T00:00:00.000Z',
        onboardingCompleted: true,
        programAssigned: true,
        programName: 'Upper split',
        lastWorkoutAt: '2026-04-02T00:00:00.000Z',
        archived: false,
        subscriptionOnFile: true,
        subscriptionActive: true,
        accessExpired: false,
      },
      {
        id: 'client-2',
        email: 'bare@example.com',
        name: null,
        createdAt: '2026-01-02T00:00:00.000Z',
        onboardingCompleted: false,
        programAssigned: false,
        programName: null,
        lastWorkoutAt: null,
        archived: false,
        subscriptionOnFile: false,
        subscriptionActive: false,
        accessExpired: false,
      },
    ]);
  });

  it('keeps a lapsed plan on file and still grants access when another row does', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'client-lapsed',
        email: 'lapsed@example.com',
        isActive: true,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        profile: null,
        workoutProgram: null,
        subscriptions: [
          {
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
          },
        ],
      },
      {
        id: 'client-both',
        email: 'both@example.com',
        isActive: true,
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
        profile: null,
        workoutProgram: null,
        subscriptions: [
          {
            status: 'EXPIRED',
            currentPeriodEnd: new Date('2020-06-01T00:00:00.000Z'),
          },
          {
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2099-06-01T00:00:00.000Z'),
          },
        ],
      },
    ]);
    const groupBy = vi.fn().mockResolvedValue([]);
    const service = createService({
      user: { findMany },
      workoutLog: { groupBy },
    });

    const result = await service.listClients();

    expect(result.clients.map((client) => client.email)).toEqual([
      'lapsed@example.com',
      'both@example.com',
    ]);
    expect(result.clients[0]).toMatchObject({
      subscriptionOnFile: true,
      subscriptionActive: false,
      accessExpired: true,
    });
    expect(result.clients[1]).toMatchObject({
      subscriptionOnFile: true,
      subscriptionActive: true,
      accessExpired: false,
    });
  });

  it('does not treat pending or canceled subscriptions as expired access', async () => {
    const findMany = vi.fn().mockResolvedValue([
      subscriptionUser('pending', [
        { status: 'PENDING', currentPeriodEnd: null },
      ]),
      subscriptionUser('expired', [
        {
          status: 'EXPIRED',
          currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
        },
      ]),
      subscriptionUser('canceled', [
        {
          status: 'CANCELED',
          currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
        },
      ]),
    ]);
    const service = createService({
      user: { findMany },
      workoutLog: { groupBy: vi.fn().mockResolvedValue([]) },
    });

    const result = await service.listClients();

    expect(result.clients.map((client) => client.accessExpired)).toEqual([
      false,
      true,
      false,
    ]);
    expect(result.clients.map((client) => client.subscriptionActive)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

function subscriptionUser(
  id: string,
  subscriptions: { status: string; currentPeriodEnd: Date | null }[],
) {
  return {
    id,
    email: `${id}@example.com`,
    isActive: true,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    profile: null,
    workoutProgram: null,
    subscriptions,
  };
}

describe('CoachService.archiveClient', () => {
  const userId = '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10';

  function transaction(options: {
    client?: { id: string; isActive: boolean } | null;
    failRevoke?: boolean;
  }) {
    let committed = false;
    const tx = {
      user: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            options.client === undefined
              ? { id: userId, isActive: true }
              : options.client,
          ),
        update: vi.fn().mockResolvedValue({ id: userId }),
      },
      authSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      authRefreshToken: {
        updateMany: vi
          .fn()
          .mockImplementation(() =>
            options.failRevoke
              ? Promise.reject(new Error('down'))
              : Promise.resolve({ count: 1 }),
          ),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (work: (client: typeof tx) => Promise<void>) => {
          await work(tx);
          committed = true;
        },
      ),
      user: { update: vi.fn() },
    };
    return { prisma, tx, committed: () => committed };
  }

  it('deactivates a client and revokes sessions in one transaction', async () => {
    const { prisma, tx, committed } = transaction({});
    const service = createService(prisma);

    await expect(service.archiveClient(userId)).resolves.toEqual({
      id: userId,
    });

    expect(committed()).toBe(true);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { isActive: false },
    });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { session: { userId }, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokes credentials again without rewriting an archived client', async () => {
    const { prisma, tx } = transaction({
      client: { id: userId, isActive: false },
    });
    const service = createService(prisma);

    await expect(service.archiveClient(userId)).resolves.toEqual({
      id: userId,
    });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.authSession.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.authRefreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not commit when revocation fails', async () => {
    const { prisma, tx, committed } = transaction({ failRevoke: true });
    const service = createService(prisma);

    await expect(service.archiveClient(userId)).rejects.toThrow('down');

    expect(committed()).toBe(false);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a missing user and a non-client', async () => {
    const { prisma, tx } = transaction({ client: null });
    const service = createService(prisma);

    await expect(service.archiveClient(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('CoachService.restoreClient', () => {
  const userId = '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10';

  function transaction(client: { id: string; isActive: boolean } | null) {
    const tx = {
      user: {
        findFirst: vi.fn().mockResolvedValue(client),
        update: vi.fn().mockResolvedValue({ id: userId }),
      },
      authSession: { updateMany: vi.fn(), create: vi.fn() },
      authRefreshToken: { updateMany: vi.fn(), create: vi.fn() },
      subscription: { updateMany: vi.fn(), create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(
        async (work: (client: typeof tx) => Promise<void>) => {
          await work(tx);
        },
      ),
    };
    return { prisma, tx };
  }

  it('reactivates an archived client without sessions or subscriptions', async () => {
    const { prisma, tx } = transaction({ id: userId, isActive: false });
    const service = createService(prisma);

    await expect(service.restoreClient(userId)).resolves.toEqual({
      id: userId,
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { isActive: true },
    });
    expect(tx.authSession.create).not.toHaveBeenCalled();
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
    expect(tx.subscription.create).not.toHaveBeenCalled();
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('leaves an already active client unchanged', async () => {
    const { prisma, tx } = transaction({ id: userId, isActive: true });
    const service = createService(prisma);

    await expect(service.restoreClient(userId)).resolves.toEqual({
      id: userId,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects a missing user and a non-client', async () => {
    const { prisma, tx } = transaction(null);
    const service = createService(prisma);

    await expect(service.restoreClient(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('CoachService.listProgramClients', () => {
  it('returns current assignees, including archived clients, for one template', async () => {
    const findUnique = vi.fn().mockResolvedValue({ name: 'Upper split' });
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'client-1',
        email: 'olena@example.com',
        isActive: false,
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
        profile: { name: 'Olena', onboardingCompletedAt: null },
        workoutProgram: { template: { name: 'Upper split' } },
        subscriptions: [],
      },
    ]);
    const groupBy = vi.fn().mockResolvedValue([]);
    const service = createService({
      programTemplate: { findUnique },
      user: { findMany },
      workoutLog: { groupBy },
    });

    const result = await service.listProgramClients(
      '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10',
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: UserRole.CLIENT,
          workoutProgram: {
            templateId: '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10',
          },
        },
      }),
    );
    expect(result.programName).toBe('Upper split');
    expect(result.clients).toHaveLength(1);
    expect(result.clients[0]).toMatchObject({
      id: 'client-1',
      archived: true,
      programAssigned: true,
    });
  });

  it('rejects a missing template before listing clients', async () => {
    const findMany = vi.fn();
    const service = createService({
      programTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findMany },
      workoutLog: { groupBy: vi.fn() },
    });

    await expect(
      service.listProgramClients('6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
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
          assignmentSource: 'MATCHED',
          template: {
            code: 'WB2U',
            name: 'Upper subtitle',
            gender: 'FEMALE',
            level: 'BEGINNER',
            frequencyPerWeek: 2,
            accent: 'UPPER',
            origin: 'SYSTEM',
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
    const service = createService({ user: { findFirst } });

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

  it('shows a granting plan, including one behind a newer ended row', async () => {
    const userId = '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10';
    function row(
      subscriptions: {
        status: 'ACTIVE' | 'EXPIRED';
        currentPeriodEnd: Date;
        plan: { name: string };
      }[],
    ) {
      return {
        id: userId,
        email: 'olena@example.com',
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
        profile: null,
        onboardingResponses: null,
        workoutProgram: null,
        subscriptions,
      };
    }
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(row([]))
      .mockResolvedValueOnce(
        row([
          {
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
            plan: { name: 'Progress' },
          },
        ]),
      )
      .mockResolvedValueOnce(
        row([
          // Newest first, matching orderBy createdAt desc. One ACTIVE row is allowed.
          {
            status: 'EXPIRED',
            currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
            plan: { name: 'Ended' },
          },
          {
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2099-06-01T00:00:00.000Z'),
            plan: { name: 'Current' },
          },
        ]),
      );
    const service = createService({ user: { findFirst } });

    await expect(service.getClient(userId)).resolves.toMatchObject({
      subscription: null,
    });
    await expect(service.getClient(userId)).resolves.toMatchObject({
      subscription: {
        active: true,
        status: 'ACTIVE',
        planName: 'Progress',
        currentPeriodEnd: '2099-01-01T00:00:00.000Z',
      },
    });
    await expect(service.getClient(userId)).resolves.toMatchObject({
      subscription: {
        active: true,
        status: 'ACTIVE',
        planName: 'Current',
      },
    });
    expect(findFirst.mock.calls[0]?.[0].select.subscriptions).toEqual({
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        currentPeriodEnd: true,
        plan: { select: { name: true } },
      },
    });
  });
});

describe('CoachService client history', () => {
  const query = { limit: 20, offset: 0 };

  function historyPrisma(client: { id: string } | null, logs: unknown[] = []) {
    return {
      user: { findFirst: vi.fn().mockResolvedValue(client) },
      workoutLog: {
        findMany: vi.fn().mockResolvedValue(logs),
        count: vi.fn().mockResolvedValue(logs.length),
      },
    };
  }

  it('returns recorded sessions from every template and skips non-clients', async () => {
    const older = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      completedAt: new Date('2026-01-02T15:00:00.000Z'),
      dayNumber: 1,
      template: { code: 'OLD', name: 'Previous block' },
      sets: [
        {
          order: 1,
          setNumber: 1,
          repsCompleted: 8,
          weightKg: { toNumber: () => 20 },
          exercise: { name: 'Тяга', nameEn: 'Row' },
        },
      ],
    };
    const newer = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      completedAt: new Date('2026-01-02T15:00:00.000Z'),
      dayNumber: 2,
      template: { code: 'NEW', name: 'Current block' },
      sets: [],
    };
    const prisma = historyPrisma({ id: 'client-1' }, [older, newer]);
    const measurements = vi.fn();
    const photos = vi.fn();
    const readPhoto = vi.fn();
    const strength = vi.fn();
    const service = createService(
      prisma,
      {
        listMeasurements: measurements,
        listProgressPhotos: photos,
        readProgressPhoto: readPhoto,
      },
      { strength },
    );

    const history = await service.listWorkouts('client-1', query);

    expect(prisma.workoutLog.findMany).toHaveBeenCalledWith({
      where: { userId: 'client-1' },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
      select: expect.objectContaining({
        template: { select: { code: true, name: true } },
      }),
    });
    expect(history.total).toBe(2);
    expect(history.logs.map((log) => log.templateCode)).toEqual(['OLD', 'NEW']);
    expect(history.logs[0]).toEqual({
      id: older.id,
      completedAt: '2026-01-02T15:00:00.000Z',
      dayNumber: 1,
      templateCode: 'OLD',
      templateName: 'Previous block',
      sets: [
        {
          order: 1,
          setNumber: 1,
          repsCompleted: 8,
          weightKg: 20,
          exercise: { name: 'Тяга', nameEn: 'Row' },
        },
      ],
    });
    expect(JSON.stringify(history)).not.toContain('recommendation');
    expect(JSON.stringify(history)).not.toContain('userId');

    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.listWorkouts('trainer-1', query),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workoutLog.findMany).toHaveBeenCalledTimes(1);
    await expect(service.listMeasurements('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listStrength('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listProgressPhotos('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.readProgressPhoto('missing', 'photo-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(measurements).not.toHaveBeenCalled();
    expect(strength).not.toHaveBeenCalled();
    expect(photos).not.toHaveBeenCalled();
    expect(readPhoto).not.toHaveBeenCalled();
  });

  it('returns an empty history and the existing measurement payload', async () => {
    const prisma = historyPrisma({ id: 'client-1' }, []);
    const measurements = vi.fn().mockResolvedValue({
      measurements: [],
      firstMeasurement: null,
    });
    const service = createService(prisma, { listMeasurements: measurements });

    await expect(service.listWorkouts('client-1', query)).resolves.toEqual({
      logs: [],
      total: 0,
    });
    await expect(service.listMeasurements('client-1')).resolves.toEqual({
      measurements: [],
      firstMeasurement: null,
    });
    expect(measurements).toHaveBeenCalledWith('client-1');
  });
});

describe('CoachService.assignProgram', () => {
  const userId = '6f1c2a40-3e0b-4a1d-9c77-0b5e8a1d2f10';
  const storedClient = {
    id: userId,
    email: 'olena@example.com',
    createdAt: new Date('2026-03-04T00:00:00.000Z'),
    profile: null,
    onboardingResponses: null,
    workoutProgram: null,
    subscriptions: [],
  };

  it('sends mail only after a committed change', async () => {
    const sendProgramAssigned = vi.fn().mockResolvedValue(undefined);
    const assignTemplate = vi.fn().mockResolvedValue({
      change: 'assigned',
      notice: {
        to: 'olena@example.com',
        kind: 'assigned',
        name: 'Upper',
        origin: 'SYSTEM',
        frequencyPerWeek: 2,
        dayCount: 2,
      },
    });
    const service = createService(
      { user: { findFirst: vi.fn().mockResolvedValue(storedClient) } },
      {},
      {},
      { assignTemplate },
      { sendProgramAssigned },
    );

    const detail = await service.assignProgram(userId, 'template-1');

    expect(assignTemplate).toHaveBeenCalledWith(userId, 'template-1');
    expect(sendProgramAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'assigned', to: 'olena@example.com' }),
    );
    expect(detail.email).toBe('olena@example.com');
  });

  it('sends the updated notice when the template is replaced', async () => {
    const sendProgramAssigned = vi.fn().mockResolvedValue(undefined);
    const service = createService(
      { user: { findFirst: vi.fn().mockResolvedValue(storedClient) } },
      {},
      {},
      {
        assignTemplate: vi.fn().mockResolvedValue({
          change: 'replaced',
          notice: {
            to: 'olena@example.com',
            kind: 'updated',
            name: 'Lower',
            origin: 'TRAINER',
            frequencyPerWeek: 3,
            dayCount: 3,
          },
        }),
      },
      { sendProgramAssigned },
    );

    await service.assignProgram(userId, 'template-2');

    expect(sendProgramAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'updated', origin: 'TRAINER' }),
    );
  });

  it('does not send mail when the assignment is unchanged or the transaction fails', async () => {
    const sendProgramAssigned = vi.fn().mockResolvedValue(undefined);
    const assignTemplate = vi
      .fn()
      .mockResolvedValueOnce({ change: 'unchanged', notice: null })
      .mockRejectedValueOnce(new Error('rolled back'));
    const service = createService(
      { user: { findFirst: vi.fn().mockResolvedValue(storedClient) } },
      {},
      {},
      { assignTemplate },
      { sendProgramAssigned },
    );

    await service.assignProgram(userId, 'template-1');
    await expect(service.assignProgram(userId, 'template-1')).rejects.toThrow(
      'rolled back',
    );
    expect(sendProgramAssigned).not.toHaveBeenCalled();
  });

  it('returns the saved client when mail delivery is still pending', async () => {
    const sendProgramAssigned = vi.fn(
      () => new Promise(() => undefined) as Promise<void>,
    );
    const service = createService(
      { user: { findFirst: vi.fn().mockResolvedValue(storedClient) } },
      {},
      {},
      {
        assignTemplate: vi.fn().mockResolvedValue({
          change: 'assigned',
          notice: {
            to: 'olena@example.com',
            kind: 'assigned',
            name: 'Upper',
            origin: 'SYSTEM',
            frequencyPerWeek: 2,
            dayCount: 2,
          },
        }),
      },
      { sendProgramAssigned },
    );

    await expect(
      service.assignProgram(userId, 'template-1'),
    ).resolves.toMatchObject({
      email: 'olena@example.com',
    });
    expect(sendProgramAssigned).toHaveBeenCalledOnce();
  });
});
