import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { TrainerTemplatesService } from './trainer-templates.service.js';

const coachId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const adminId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const templateId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const exerciseId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const coach = { id: coachId, role: 'ADMIN' as const };
const admin = { id: adminId, role: 'ADMIN' as const };

const input = {
  name: 'Upper',
  gender: 'female' as const,
  level: 'beginner' as const,
  frequencyPerWeek: 2 as const,
  accent: 'UPPER' as const,
  days: [1, 2].map((dayNumber) => ({
    dayNumber,
    exercises: [
      {
        exerciseId,
        order: 1,
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        allowsAbsAddon: false,
      },
    ],
  })),
};

function stored(ownerId: string | null = coachId) {
  return {
    id: templateId,
    code: 'Tabcdef01234567',
    name: 'Upper',
    gender: 'FEMALE' as const,
    level: 'BEGINNER' as const,
    frequencyPerWeek: 2,
    accent: 'UPPER' as const,
    origin: 'TRAINER' as const,
    ownerId,
    active: true,
    createdAt: new Date('2026-10-24T00:00:00.000Z'),
    updatedAt: new Date('2026-10-24T00:00:00.000Z'),
    days: input.days.map((day) => ({
      dayNumber: day.dayNumber,
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        exercise: {
          id: exerciseId,
          code: 'EX_039',
          name: 'Row',
          nameEn: 'Row',
          muscleGroups: ['BACK' as const],
          repsMin: 8,
          repsMax: 12,
        },
      })),
    })),
  };
}

function collision(target?: string | string[]) {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: '6.16.2',
    ...(target === undefined ? {} : { meta: { target } }),
  });
}

function createService() {
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        { id: templateId, origin: 'TRAINER', ownerId: coachId },
      ]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    exercise: {
      findMany: vi.fn().mockResolvedValue([{ id: exerciseId }]),
    },
    programTemplate: {
      findUnique: vi.fn().mockResolvedValue(stored()),
      create: vi.fn().mockResolvedValue(stored()),
      update: vi.fn().mockResolvedValue(stored()),
      delete: vi.fn().mockResolvedValue(stored()),
    },
    programTemplateDay: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    workoutLog: {
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    workoutProgram: { count: vi.fn().mockResolvedValue(0) },
  };
  const prisma = {
    $transaction: vi.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
    programTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
    workoutProgram: {
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    workoutLog: { count: vi.fn().mockResolvedValue(0) },
  };
  return {
    tx,
    prisma,
    service: new TrainerTemplatesService(prisma as never),
  };
}

describe('TrainerTemplatesService ownership', () => {
  it('rejects a client before changing a template', async () => {
    const { service, tx } = createService();
    const client = { id: coachId, role: 'CLIENT' as const };

    await expect(
      service.update(client, templateId, input),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(client, templateId)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
    await expect(service.duplicate(client, templateId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns a system template for inspection', async () => {
    const { service, prisma } = createService();
    prisma.programTemplate.findUnique.mockResolvedValue({
      ...stored(null),
      origin: 'SYSTEM',
      ownerId: null,
    });

    const detail = await service.get(admin, templateId);

    expect(detail.origin).toBe('SYSTEM');
    expect(detail.ownerId).toBeNull();
    expect(detail.dayCount).toBe(2);
    expect(detail.exerciseCount).toBe(2);
  });

  it('lists system and custom templates', async () => {
    const { service, prisma } = createService();
    prisma.programTemplate.findMany.mockResolvedValue([
      {
        ...stored(null),
        origin: 'SYSTEM',
        ownerId: null,
        days: [{ _count: { exercises: 4 } }, { _count: { exercises: 3 } }],
      },
    ]);

    const listed = await service.list(admin);

    expect(listed.templates[0]).toMatchObject({
      origin: 'SYSTEM',
      ownerId: null,
      dayCount: 2,
      exerciseCount: 7,
      assignedCount: 0,
    });
  });

  it('counts clients assigned to each template in one query', async () => {
    const { service, prisma } = createService();
    prisma.programTemplate.findMany.mockResolvedValue([
      {
        ...stored(null),
        origin: 'SYSTEM',
        ownerId: null,
        days: [{ _count: { exercises: 1 } }],
      },
    ]);
    prisma.workoutProgram.groupBy.mockResolvedValue([
      { templateId, _count: { _all: 3 } },
    ]);

    const listed = await service.list(admin);

    expect(prisma.workoutProgram.groupBy).toHaveBeenCalledWith({
      by: ['templateId'],
      _count: { _all: true },
    });
    expect(listed.templates[0]?.assignedCount).toBe(3);
  });

  it('copies a system template without locking or changing it', async () => {
    const { service, prisma, tx } = createService();
    prisma.programTemplate.findUnique.mockResolvedValue({
      ...stored(null),
      origin: 'SYSTEM',
      ownerId: null,
      active: false,
    });

    await service.duplicate(admin, templateId);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.programTemplate.update).not.toHaveBeenCalled();
    expect(tx.programTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origin: 'TRAINER',
          ownerId: adminId,
          active: true,
          name: 'Upper - copy',
        }),
      }),
    );
  });

  it('rejects a system template', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([
      { id: templateId, origin: 'SYSTEM', ownerId: null },
    ]);

    await expect(
      service.update(admin, templateId, input),
    ).rejects.toMatchObject({
      response: { code: 'TEMPLATE_NOT_FOUND' },
    });
    expect(tx.programTemplate.update).not.toHaveBeenCalled();
  });

  it('lets an admin change a coach template they do not own', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([
      { id: templateId, origin: 'TRAINER', ownerId: otherId },
    ]);

    await service.update(admin, templateId, input);

    expect(tx.programTemplate.update).toHaveBeenCalledOnce();
  });

  it('keeps the source owner when an admin duplicates a template', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([
      { id: templateId, origin: 'TRAINER', ownerId: otherId },
    ]);
    tx.programTemplate.findUnique.mockResolvedValue(stored(otherId));

    await service.duplicate(admin, templateId);

    expect(tx.programTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origin: 'TRAINER',
          ownerId: otherId,
          active: true,
          name: 'Upper - copy',
        }),
      }),
    );
  });
});

describe('TrainerTemplatesService conflicts', () => {
  it('rejects an edit while a client is assigned and has no logs', async () => {
    const { service, tx } = createService();
    tx.workoutProgram.count.mockResolvedValue(1);
    tx.workoutLog.count.mockResolvedValue(0);

    await expect(
      service.update(coach, templateId, input),
    ).rejects.toMatchObject({ response: { code: 'TEMPLATE_IN_USE' } });
    expect(tx.programTemplateDay.deleteMany).not.toHaveBeenCalled();
    expect(tx.programTemplate.update).not.toHaveBeenCalled();
  });

  it('rejects an edit once a workout log exists', async () => {
    const { service, tx } = createService();
    tx.workoutLog.count.mockResolvedValue(1);

    await expect(
      service.update(coach, templateId, input),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.update(coach, templateId, input),
    ).rejects.toMatchObject({
      response: { code: 'TEMPLATE_HAS_LOGS' },
    });
    expect(tx.programTemplateDay.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects delete when the template is assigned and changes nothing', async () => {
    const { service, tx } = createService();
    tx.workoutProgram.count.mockResolvedValue(1);
    tx.workoutLog.count.mockResolvedValue(3);

    await expect(service.remove(coach, templateId)).rejects.toMatchObject({
      response: { code: 'TEMPLATE_IN_USE' },
    });
    expect(tx.workoutLog.updateMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.programTemplate.delete).not.toHaveBeenCalled();
    expect(tx.programTemplateDay.deleteMany).not.toHaveBeenCalled();
  });

  it('renames a template that has logs without touching its structure', async () => {
    const { service, tx } = createService();
    tx.workoutLog.count.mockResolvedValue(2);
    tx.workoutProgram.count.mockResolvedValue(1);
    tx.programTemplate.update.mockResolvedValue({
      ...stored(),
      name: 'Renamed',
    });

    const detail = await service.rename(coach, templateId, 'Renamed');

    expect(detail.name).toBe('Renamed');
    expect(detail.logCount).toBe(2);
    expect(detail.assignedCount).toBe(1);
    expect(tx.programTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: templateId },
        data: { name: 'Renamed' },
      }),
    );
    expect(tx.programTemplateDay.deleteMany).not.toHaveBeenCalled();
    expect(tx.workoutLog.updateMany).not.toHaveBeenCalled();
    expect(tx.programTemplate.delete).not.toHaveBeenCalled();
  });

  it('renames a template that has no logs', async () => {
    const { service, tx } = createService();
    tx.programTemplate.update.mockResolvedValue({
      ...stored(),
      name: 'Fresh name',
    });

    await service.rename(coach, templateId, 'Fresh name');

    expect(tx.programTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Fresh name' } }),
    );
    expect(tx.programTemplateDay.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes an unassigned template that has no logs', async () => {
    const { service, tx } = createService();
    tx.workoutLog.updateMany.mockResolvedValue({ count: 0 });

    await service.remove(coach, templateId);

    expect(tx.workoutLog.updateMany).toHaveBeenCalledWith({
      where: { templateId },
      data: {
        templateId: null,
        templateCode: 'Tabcdef01234567',
        templateName: 'Upper',
      },
    });
    expect(tx.programTemplate.delete).toHaveBeenCalledWith({
      where: { id: templateId },
    });
  });

  it('deletes an unassigned template and keeps every log', async () => {
    const { service, tx, prisma } = createService();
    tx.workoutProgram.count.mockResolvedValue(0);
    tx.workoutLog.updateMany.mockResolvedValue({ count: 2 });

    await service.remove(coach, templateId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.workoutLog.updateMany).toHaveBeenCalledWith({
      where: { templateId },
      data: {
        templateId: null,
        templateCode: 'Tabcdef01234567',
        templateName: 'Upper',
      },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.workoutLog.updateMany.mock.invocationCallOrder[0]!,
    );
    expect(tx.programTemplate.delete).toHaveBeenCalledWith({
      where: { id: templateId },
    });
  });

  it('rolls the log detach back when delete fails', async () => {
    const { service, tx, prisma } = createService();
    tx.programTemplate.delete.mockRejectedValue(new Error('disk'));

    await expect(service.remove(coach, templateId)).rejects.toThrow('disk');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.workoutLog.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.programTemplateDay.deleteMany).not.toHaveBeenCalled();
  });

  it('retries only a code collision', async () => {
    const { service, tx, prisma } = createService();
    tx.programTemplate.create
      .mockRejectedValueOnce(collision(['code']))
      .mockResolvedValueOnce(stored());

    await service.create(coach, input);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry a unique failure on another field', async () => {
    const { service, tx, prisma } = createService();
    tx.programTemplate.create.mockRejectedValueOnce(
      collision(['templateId', 'dayNumber']),
    );

    await expect(service.create(coach, input)).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not retry a unique failure that does not name the code field', async () => {
    const { service, prisma } = createService();
    prisma.$transaction.mockRejectedValueOnce(collision());

    await expect(service.create(coach, input)).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when an exercise does not exist', async () => {
    const { service, tx } = createService();
    tx.exercise.findMany.mockResolvedValue([]);

    await expect(service.create(coach, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create(coach, input)).rejects.toMatchObject({
      response: { code: 'EXERCISE_NOT_FOUND' },
    });
  });
});
