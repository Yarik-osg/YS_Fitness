import { createRequire } from 'node:module';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole, type ProgramTemplate } from '@prisma/client';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';

const { databaseName, devDatabaseUrl } = createRequire(import.meta.url)(
  '../../../scripts/e2e-database.mjs',
) as {
  databaseName: (value: string) => string;
  devDatabaseUrl: () => string;
};

const testDatabaseUrl = readTestDatabaseUrl();
const testDatabaseName = testDatabaseUrl ? databaseName(testDatabaseUrl) : '';
const devName = databaseName(devDatabaseUrl());

if (
  testDatabaseUrl &&
  (testDatabaseName !== 'ys_fitness_test' || testDatabaseName === devName)
) {
  throw new Error(
    'Refusing to run: TEST_DATABASE_URL must be the ys_fitness_test database and must not be the dev database.',
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const accountEmails = [
  'tpl-trainer@example.com',
  'tpl-other@example.com',
  'tpl-admin@example.com',
  'tpl-client@example.com',
];

type Account = { id: string; authorization: string };

describeWithDatabase('trainer program templates (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let trainer: Account;
  let otherTrainer: Account;
  let admin: Account;
  let client: Account;
  let exerciseId: string;
  let otherExerciseId: string;
  let planId: string;

  beforeAll(async () => {
    configureE2eEnvironment(testDatabaseUrl!);
    const [{ Test }, { AppModule }] = await Promise.all([
      import('@nestjs/testing'),
      import('../src/app.module.js'),
    ]);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    await app.listen(0);
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl! } },
    });
    await removeAccounts(prisma, accountEmails);
    const exercises = await prisma.exercise.findMany({ take: 2 });
    if (exercises.length < 2) throw new Error('seeded exercises missing');
    exerciseId = exercises[0]!.id;
    otherExerciseId = exercises[1]!.id;
    const plan = await prisma.plan.create({
      data: {
        code: `COACH_TPL_${Date.now()}`,
        name: 'Trainer template e2e',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
      },
    });
    planId = plan.id;
    [trainer, otherTrainer, admin, client] = await Promise.all([
      createUser('tpl-trainer@example.com', UserRole.ADMIN),
      createUser('tpl-other@example.com', UserRole.ADMIN),
      createUser('tpl-admin@example.com', UserRole.ADMIN),
      createUser('tpl-client@example.com', UserRole.CLIENT),
    ]);
  });

  afterEach(async () => {
    const owned = await prisma.programTemplate.findMany({
      where: { ownerId: { in: [trainer.id, otherTrainer.id, admin.id] } },
      select: { id: true },
    });
    const ids = owned.map((row) => row.id);
    const userIds = [trainer.id, otherTrainer.id, admin.id, client.id];
    await prisma.workoutProgram.deleteMany({
      where: { userId: { in: userIds } },
    });
    if (ids.length > 0) {
      await prisma.workoutLog.deleteMany({
        where: { templateId: { in: ids } },
      });
      await prisma.programTemplate.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.subscription.deleteMany({
      where: { userId: { in: userIds } },
    });
  });

  afterAll(async () => {
    await removeAccounts(prisma, accountEmails);
    await prisma.plan.deleteMany({ where: { id: planId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects ownerId, origin, and code on a strict body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/coach/program-templates')
      .set('authorization', trainer.authorization)
      .send({
        ...templateBody(exerciseId),
        ownerId: trainer.id,
        origin: 'SYSTEM',
        code: 'WB2U',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('hides the library from a client', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/coach/program-templates')
      .set('authorization', client.authorization)
      .send(templateBody(exerciseId));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/coach/program-templates')
      .set('authorization', client.authorization);
    expect(listed.status).toBe(403);

    const exercises = await request(app.getHttpServer())
      .get('/api/v1/coach/program-templates/exercises')
      .set('authorization', client.authorization);
    expect(exercises.status).toBe(403);
  });

  it('lists both system and custom templates and copies a system template', async () => {
    const created = await createTemplate(trainer.authorization);
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/coach/program-templates/${created.body.id}`)
      .set('authorization', otherTrainer.authorization)
      .send(templateBody(exerciseId));
    expect(updated.status).toBe(200);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/coach/program-templates')
      .set('authorization', trainer.authorization);
    expect(listed.status).toBe(200);
    expect(
      listed.body.templates.some(
        (template: { origin: string }) => template.origin === 'SYSTEM',
      ),
    ).toBe(true);
    expect(
      listed.body.templates.some(
        (template: { id: string; origin: string }) =>
          template.id === created.body.id && template.origin === 'TRAINER',
      ),
    ).toBe(true);

    const deniedExercises = await request(app.getHttpServer())
      .get('/api/v1/coach/program-templates/exercises')
      .set('authorization', client.authorization);
    expect(deniedExercises.status).toBe(403);
    const exercises = await request(app.getHttpServer())
      .get('/api/v1/coach/program-templates/exercises')
      .set('authorization', trainer.authorization);
    expect(exercises.status).toBe(200);
    expect(exercises.body.length).toBeGreaterThan(0);

    const system = await prisma.programTemplate.findFirst({
      where: { origin: 'SYSTEM' },
      include: { days: { include: { exercises: true } } },
    });
    if (!system) throw new Error('seeded system template missing');

    for (const method of ['put', 'delete'] as const) {
      const call =
        method === 'put'
          ? request(app.getHttpServer()).put(
              `/api/v1/coach/program-templates/${system.id}`,
            )
          : request(app.getHttpServer()).delete(
              `/api/v1/coach/program-templates/${system.id}`,
            );
      const response = await call
        .set('authorization', otherTrainer.authorization)
        .send(templateBody(exerciseId));
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('TEMPLATE_NOT_FOUND');
    }

    const duplicated = await request(app.getHttpServer())
      .post(`/api/v1/coach/program-templates/${system.id}/duplicate`)
      .set('authorization', otherTrainer.authorization);
    expect(duplicated.status).toBe(201);
    expect(duplicated.body.id).not.toBe(system.id);
    expect(duplicated.body.origin).toBe('TRAINER');
    expect(duplicated.body.ownerId).toBe(otherTrainer.id);
    expect(duplicated.body.name).toBe(`${system.name} - copy`);

    const after = await prisma.programTemplate.findUnique({
      where: { id: system.id },
      include: { days: { include: { exercises: true } } },
    });
    expect(after?.origin).toBe('SYSTEM');
    expect(after?.updatedAt.toISOString()).toBe(system.updatedAt.toISOString());
    expect(after?.name).toBe(system.name);
    expect(after?.days).toHaveLength(system.days.length);
  });

  it('lets a trainer template reuse a system identity', async () => {
    const system = await prisma.programTemplate.findFirst({
      where: { origin: 'SYSTEM', active: true },
    });
    if (!system) throw new Error('seeded system template missing');

    const response = await request(app.getHttpServer())
      .post('/api/v1/coach/program-templates')
      .set('authorization', trainer.authorization)
      .send(identityBody(system, exerciseId));

    expect(response.status).toBe(201);
    expect(response.body.gender).toBe(
      system.gender === 'FEMALE' ? 'female' : 'male',
    );
    expect(response.body.accent).toBe(system.accent);
    expect(response.body.ownerId).toBe(trainer.id);

    const visible = await request(app.getHttpServer())
      .get(`/api/v1/coach/program-templates/${response.body.id}`)
      .set('authorization', admin.authorization);
    expect(visible.status).toBe(200);
    expect(visible.body.days).toHaveLength(system.frequencyPerWeek);
  });

  it('blocks edit and delete once the template has history', async () => {
    const created = await createTemplate(trainer.authorization);
    const templateId = created.body.id as string;
    await prisma.workoutLog.create({
      data: {
        userId: client.id,
        templateId,
        dayNumber: 1,
        sets: {
          create: {
            exerciseId,
            order: 1,
            setNumber: 1,
            repsCompleted: 10,
          },
        },
      },
    });

    const edited = await request(app.getHttpServer())
      .put(`/api/v1/coach/program-templates/${templateId}`)
      .set('authorization', trainer.authorization)
      .send(templateBody(exerciseId));
    expect(edited.status).toBe(409);
    expect(edited.body.code).toBe('TEMPLATE_HAS_LOGS');

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/coach/program-templates/${templateId}`)
      .set('authorization', trainer.authorization);
    expect(removed.status).toBe(409);
    expect(removed.body.code).toBe('TEMPLATE_IN_USE');

    await prisma.workoutLog.deleteMany({ where: { templateId } });
    await prisma.workoutProgram.create({
      data: { userId: client.id, templateId },
    });
    const assigned = await request(app.getHttpServer())
      .delete(`/api/v1/coach/program-templates/${templateId}`)
      .set('authorization', trainer.authorization);
    expect(assigned.status).toBe(409);
    expect(assigned.body.code).toBe('TEMPLATE_IN_USE');
  });

  it('waits for an in-flight log and then rejects the edit', async () => {
    const created = await createTemplate(trainer.authorization);
    const templateId = created.body.id as string;
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inserted = false;
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM program_templates
          WHERE id = CAST(${templateId} AS uuid)
          FOR UPDATE
        `;
        await tx.workoutLog.create({
          data: {
            userId: client.id,
            templateId,
            dayNumber: 1,
            sets: {
              create: {
                exerciseId,
                order: 1,
                setNumber: 1,
                repsCompleted: 10,
              },
            },
          },
        });
        inserted = true;
        await hold;
      },
      { timeout: 20_000 },
    );

    try {
      await waitUntil(() => inserted);
      const update = request(app.getHttpServer())
        .put(`/api/v1/coach/program-templates/${templateId}`)
        .set('authorization', trainer.authorization)
        .send(templateBody(exerciseId))
        .then((response) => response);
      await waitForTemplateLock(prisma);
      release();
      const response = await update;
      await holder;

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('TEMPLATE_HAS_LOGS');
    } finally {
      release();
      await holder.catch(() => undefined);
    }
  }, 20_000);

  it('does not commit a log against a day tree replaced while it waited', async () => {
    const created = await createTemplate(trainer.authorization);
    const templateId = created.body.id as string;
    await prisma.workoutProgram.create({
      data: { userId: client.id, templateId },
    });
    await prisma.subscription.create({
      data: {
        userId: client.id,
        planId,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = false;
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM program_templates
          WHERE id = CAST(${templateId} AS uuid)
          FOR UPDATE
        `;
        locked = true;
        await hold;
        await tx.programTemplateDay.deleteMany({ where: { templateId } });
        await tx.programTemplateDay.create({
          data: {
            templateId,
            dayNumber: 1,
            exercises: {
              create: {
                exerciseId: otherExerciseId,
                order: 1,
                sets: 3,
                repsMin: 8,
                repsMax: 12,
                allowsAbsAddon: false,
              },
            },
          },
        });
        await tx.programTemplateDay.create({
          data: {
            templateId,
            dayNumber: 2,
            exercises: {
              create: {
                exerciseId,
                order: 1,
                sets: 3,
                repsMin: 8,
                repsMax: 12,
                allowsAbsAddon: false,
              },
            },
          },
        });
      },
      { timeout: 20_000 },
    );

    try {
      await waitUntil(() => locked);
      const logged = request(app.getHttpServer())
        .post('/api/v1/workouts/log')
        .set('authorization', client.authorization)
        .send({
          templateId,
          dayNumber: 1,
          sets: [
            {
              exerciseId,
              order: 1,
              setNumber: 1,
              repsCompleted: 10,
            },
          ],
        })
        .then((response) => response);
      await waitForTemplateLock(prisma);
      release();
      const response = await logged;
      await holder;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('EXERCISE_NOT_ON_DAY');
      await expect(
        prisma.workoutLog.count({ where: { templateId } }),
      ).resolves.toBe(0);
    } finally {
      release();
      await holder.catch(() => undefined);
    }
  }, 20_000);

  async function createUser(email: string, role: UserRole): Promise<Account> {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash('strong-password'),
        role,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strong-password', clientType: 'MOBILE' })
      .expect(200);
    return {
      id: user.id,
      authorization: `Bearer ${login.body.tokens.accessToken}`,
    };
  }

  async function createTemplate(authorization: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/coach/program-templates')
      .set('authorization', authorization)
      .send(templateBody(exerciseId));
    expect(response.status).toBe(201);
    return response;
  }
});

function templateBody(exerciseId: string) {
  return {
    name: 'Trainer upper',
    gender: 'female',
    level: 'beginner',
    frequencyPerWeek: 2,
    accent: 'UPPER',
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
}

function identityBody(system: ProgramTemplate, exerciseId: string) {
  const frequency = system.frequencyPerWeek;
  if (frequency !== 2 && frequency !== 3 && frequency !== 4) {
    throw new Error('seeded frequency is outside 2, 3, and 4');
  }
  return {
    ...templateBody(exerciseId),
    name: 'Trainer identity',
    gender: system.gender === 'FEMALE' ? 'female' : 'male',
    level: system.level.toLowerCase(),
    frequencyPerWeek: frequency,
    accent: system.accent,
    days: Array.from({ length: frequency }, (_, index) => ({
      dayNumber: index + 1,
      exercises: templateBody(exerciseId).days[0]!.exercises,
    })),
  };
}

async function removeAccounts(
  prisma: PrismaClient,
  emails: string[],
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;
  const templates = await prisma.programTemplate.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const templateIds = templates.map((template) => template.id);
  await prisma.workoutProgram.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        ...(templateIds.length > 0
          ? [{ templateId: { in: templateIds } }]
          : []),
      ],
    },
  });
  if (templateIds.length > 0) {
    await prisma.workoutLog.deleteMany({
      where: { templateId: { in: templateIds } },
    });
    await prisma.programTemplate.deleteMany({
      where: { id: { in: templateIds } },
    });
  }
  await prisma.workoutLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.subscription.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.authSession.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function waitUntil(ready: () => boolean): Promise<void> {
  const started = Date.now();
  while (!ready()) {
    if (Date.now() - started > 5_000) {
      throw new Error('timed out waiting for the template transaction');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function waitForTemplateLock(prisma: PrismaClient): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 8_000) {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM pg_locks
      WHERE NOT granted
    `;
    if (Number(rows[0]?.count ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('timed out waiting for the template lock');
}
