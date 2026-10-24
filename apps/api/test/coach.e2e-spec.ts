import type { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';

const testDatabaseUrl = readTestDatabaseUrl() ?? '';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

const SUMMARY_FIELDS = [
  'createdAt',
  'email',
  'id',
  'name',
  'onboardingCompleted',
  'programAssigned',
  'subscriptionActive',
];

describeWithDatabase('coach clients (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  async function createUser(
    email: string,
    role: UserRole = UserRole.CLIENT,
    createdAt?: Date,
  ) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash('strong-password'),
        role,
        ...(createdAt ? { createdAt } : {}),
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strong-password', clientType: 'MOBILE' })
      .expect(200);
    return {
      id: user.id,
      authorization: `Bearer ${login.body.tokens.accessToken}` as string,
    };
  }

  beforeAll(async () => {
    configureE2eEnvironment(testDatabaseUrl);
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
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
  });

  beforeEach(async () => {
    await prisma.subscription.deleteMany();
    await prisma.workoutProgram.deleteMany();
    await prisma.authRefreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.bodyMeasurement.deleteMany();
    await prisma.onboardingResponses.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('hides the roster from a client and returns only client summaries to a coach', async () => {
    const clientAccount = await createUser(
      'roster-client@example.com',
      UserRole.CLIENT,
      new Date('2026-01-02T00:00:00.000Z'),
    );
    const bare = await createUser(
      'roster-bare@example.com',
      UserRole.CLIENT,
      new Date('2026-03-04T00:00:00.000Z'),
    );
    const pending = await createUser(
      'roster-pending@example.com',
      UserRole.CLIENT,
      new Date('2026-02-02T00:00:00.000Z'),
    );
    const trainer = await createUser(
      'roster-trainer@example.com',
      UserRole.TRAINER,
    );
    const admin = await createUser('roster-admin@example.com', UserRole.ADMIN);

    await prisma.userProfile.create({
      data: {
        userId: clientAccount.id,
        name: 'Olena Koval',
        dateOfBirth: new Date('1994-04-12'),
        biologicalSexForCalculation: 'FEMALE',
        heightCm: 168,
        activityLevel: 'MODERATELY_ACTIVE',
        goal: 'MAINTAIN_WEIGHT',
        onboardingCompletedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    });
    const template = await prisma.programTemplate.findFirst({
      where: { active: true },
    });
    if (!template) throw new Error('seeded template missing');
    await prisma.workoutProgram.create({
      data: { userId: clientAccount.id, templateId: template.id },
    });
    const plan = await prisma.plan.create({
      data: {
        code: 'COACH_E2E',
        name: 'Coach e2e',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
      },
    });
    await prisma.subscription.create({
      data: {
        userId: clientAccount.id,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: bare.id,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      },
    });

    await prisma.subscription.create({
      data: {
        userId: pending.id,
        planId: plan.id,
        status: 'PENDING',
        provider: 'MOCK',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/coach/clients')
      .set('Authorization', clientAccount.authorization)
      .expect(403);

    const trainerRoster = await request(app.getHttpServer())
      .get('/api/v1/coach/clients')
      .set('Authorization', trainer.authorization)
      .expect(200);
    const adminRoster = await request(app.getHttpServer())
      .get('/api/v1/coach/clients')
      .set('Authorization', admin.authorization)
      .expect(200);

    expect(adminRoster.body).toEqual(trainerRoster.body);
    const emails = trainerRoster.body.clients.map(
      (client: { email: string }) => client.email,
    );
    expect(emails).toEqual([
      'roster-bare@example.com',
      'roster-pending@example.com',
      'roster-client@example.com',
    ]);
    expect(emails).not.toContain('roster-trainer@example.com');
    expect(emails).not.toContain('roster-admin@example.com');

    for (const client of trainerRoster.body.clients) {
      expect(Object.keys(client).sort()).toEqual(SUMMARY_FIELDS);
    }

    const named = trainerRoster.body.clients.find(
      (client: { email: string }) =>
        client.email === 'roster-client@example.com',
    );
    expect(named).toMatchObject({
      email: 'roster-client@example.com',
      name: 'Olena Koval',
      onboardingCompleted: true,
      programAssigned: true,
      subscriptionActive: true,
    });
    const unnamed = trainerRoster.body.clients.find(
      (client: { email: string }) => client.email === 'roster-bare@example.com',
    );
    expect(unnamed).toMatchObject({
      email: 'roster-bare@example.com',
      name: null,
      onboardingCompleted: false,
      programAssigned: false,
      subscriptionActive: false,
    });
    const waiting = trainerRoster.body.clients.find(
      (client: { email: string }) =>
        client.email === 'roster-pending@example.com',
    );
    expect(waiting).toMatchObject({ subscriptionActive: false });
  });

  it('returns one client file to a coach and hides everyone else', async () => {
    const clientAccount = await createUser('detail-client@example.com');
    const bare = await createUser('detail-bare@example.com');
    const pending = await createUser('detail-pending@example.com');
    const trainer = await createUser(
      'detail-trainer@example.com',
      UserRole.TRAINER,
    );
    const admin = await createUser('detail-admin@example.com', UserRole.ADMIN);

    await prisma.userProfile.create({
      data: {
        userId: clientAccount.id,
        name: 'Olena Koval',
        dateOfBirth: new Date('1994-04-12'),
        biologicalSexForCalculation: 'FEMALE',
        heightCm: 168,
        activityLevel: 'MODERATELY_ACTIVE',
        goal: 'MAINTAIN_WEIGHT',
        onboardingCompletedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    });
    await prisma.onboardingResponses.create({
      data: {
        userId: clientAccount.id,
        programTrack: 'FEMALE',
        currentBody: '2',
        desiredBody: '4',
        mainGoal: 'MAINTAIN',
        experience: 'BEGINNER',
        trainingFrequency: '3',
        focusAreas: ['glutes'],
        nutritionCurrent: 'BALANCED',
        mealsPerDay: '3',
        eatingHabits: ['none'],
      },
    });
    const template = await prisma.programTemplate.findFirst({
      where: { active: true },
    });
    if (!template) throw new Error('seeded template missing');
    await prisma.workoutProgram.create({
      data: { userId: clientAccount.id, templateId: template.id },
    });
    const plan = await prisma.plan.create({
      data: {
        code: 'COACH_DETAIL_E2E',
        name: 'Coach detail',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
      },
    });
    await prisma.subscription.create({
      data: {
        userId: clientAccount.id,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: bare.id,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: pending.id,
        planId: plan.id,
        status: 'PENDING',
        provider: 'MOCK',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });

    const path = `/api/v1/coach/clients/${clientAccount.id}`;
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', clientAccount.authorization)
      .expect(403);
    const invalid = await request(app.getHttpServer())
      .get('/api/v1/coach/clients/not-a-uuid')
      .set('Authorization', trainer.authorization)
      .expect(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
    const missing = await request(app.getHttpServer())
      .get('/api/v1/coach/clients/00000000-0000-4000-8000-000000000000')
      .set('Authorization', trainer.authorization)
      .expect(404);
    expect(missing.body.code).toBe('CLIENT_NOT_FOUND');
    const trainerAsClient = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${trainer.id}`)
      .set('Authorization', trainer.authorization)
      .expect(404);
    expect(trainerAsClient.body.code).toBe('CLIENT_NOT_FOUND');
    const adminAsClient = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${admin.id}`)
      .set('Authorization', trainer.authorization)
      .expect(404);
    expect(adminAsClient.body.code).toBe('CLIENT_NOT_FOUND');

    const trainerFile = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', trainer.authorization)
      .expect(200);
    const adminFile = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', admin.authorization)
      .expect(200);
    expect(adminFile.body).toEqual(trainerFile.body);
    expect(Object.keys(trainerFile.body).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'onboarding',
      'onboardingCompleted',
      'profile',
      'program',
      'subscription',
    ]);
    expect(trainerFile.body).toMatchObject({
      email: 'detail-client@example.com',
      name: 'Olena Koval',
      onboardingCompleted: true,
      onboarding: { mainGoal: 'maintain', focusAreas: ['glutes'] },
      program: {
        templateCode: template.code,
        accent: template.accent,
      },
      subscription: {
        active: true,
        status: 'ACTIVE',
        planName: 'Coach detail',
      },
    });
    expect(JSON.stringify(trainerFile.body)).not.toContain('passwordHash');
    expect(trainerFile.body.profile.healthRestrictions).toBeUndefined();

    const bareFile = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${bare.id}`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    expect(bareFile.body).toMatchObject({
      profile: null,
      onboarding: null,
      program: null,
      subscription: { active: false, status: 'ACTIVE' },
    });

    const pendingFile = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${pending.id}`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    expect(pendingFile.body.subscription).toMatchObject({
      active: false,
      status: 'PENDING',
    });

    await prisma.exercise.deleteMany({ where: { code: 'COACH_HIST_ROW' } });
    const exercise = await prisma.exercise.create({
      data: {
        code: 'COACH_HIST_ROW',
        name: 'Тяга',
        nameEn: 'Row',
        muscleGroups: ['BACK'],
        repsMin: 8,
        repsMax: 12,
      },
    });
    const olderTemplate = await prisma.programTemplate.findFirst({
      where: { id: { not: template.id } },
      orderBy: { code: 'asc' },
    });
    if (!olderTemplate) throw new Error('second template missing');
    const sameTime = new Date('2026-02-01T10:00:00.000Z');
    const newerLog = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    const tiedLog = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    await prisma.workoutLog.create({
      data: {
        id: tiedLog,
        userId: clientAccount.id,
        templateId: olderTemplate.id,
        dayNumber: 1,
        completedAt: sameTime,
        sets: {
          create: [
            {
              exerciseId: exercise.id,
              order: 1,
              setNumber: 1,
              repsCompleted: 8,
              weightKg: 20,
            },
          ],
        },
      },
    });
    await prisma.workoutLog.create({
      data: {
        id: newerLog,
        userId: clientAccount.id,
        templateId: template.id,
        dayNumber: 2,
        completedAt: sameTime,
        sets: {
          create: [
            {
              exerciseId: exercise.id,
              order: 1,
              setNumber: 1,
              repsCompleted: 6,
              weightKg: 30,
            },
          ],
        },
      },
    });
    await prisma.bodyMeasurement.create({
      data: {
        userId: clientAccount.id,
        weightKg: 64.5,
        measuredAt: new Date('2026-02-02T00:00:00.000Z'),
      },
    });
    const ownPhoto = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
    const otherPhoto = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
    await prisma.progressPhoto.createMany({
      data: [
        {
          id: ownPhoto,
          userId: clientAccount.id,
          contentType: 'image/jpeg',
          storageKey: `${clientAccount.id}/${ownPhoto}.jpg`,
          width: 2,
          height: 2,
        },
        {
          id: otherPhoto,
          userId: bare.id,
          contentType: 'image/jpeg',
          storageKey: `${bare.id}/${otherPhoto}.jpg`,
          width: 2,
          height: 2,
        },
      ],
    });

    const reads = [
      `/api/v1/coach/clients/${clientAccount.id}/workouts`,
      `/api/v1/coach/clients/${clientAccount.id}/measurements`,
      `/api/v1/coach/clients/${clientAccount.id}/strength`,
      `/api/v1/coach/clients/${clientAccount.id}/progress-photos`,
      `/api/v1/coach/clients/${clientAccount.id}/progress-photos/${ownPhoto}`,
    ];
    for (const path of reads) {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', clientAccount.authorization)
        .expect(403);
    }

    const deniedIds = [
      '00000000-0000-4000-8000-000000000000',
      trainer.id,
      admin.id,
    ];
    for (const userId of deniedIds) {
      for (const authorization of [
        trainer.authorization,
        admin.authorization,
      ]) {
        for (const path of [
          `/api/v1/coach/clients/${userId}/workouts`,
          `/api/v1/coach/clients/${userId}/measurements`,
          `/api/v1/coach/clients/${userId}/strength`,
          `/api/v1/coach/clients/${userId}/progress-photos`,
          `/api/v1/coach/clients/${userId}/progress-photos/${ownPhoto}`,
        ]) {
          const response = await request(app.getHttpServer())
            .get(path)
            .set('Authorization', authorization)
            .expect(404);
          expect(response.body.code).toBe('CLIENT_NOT_FOUND');
          expect(JSON.stringify(response.body)).not.toContain('storageKey');
        }
      }
    }

    const page = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${clientAccount.id}/workouts?limit=1`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    expect(page.body.total).toBe(2);
    expect(page.body.logs).toHaveLength(1);
    expect(page.body.logs[0].id).toBe(newerLog);
    expect(Object.keys(page.body.logs[0]).sort()).toEqual([
      'completedAt',
      'dayNumber',
      'id',
      'sets',
      'templateCode',
      'templateName',
    ]);
    expect(Object.keys(page.body.logs[0].sets[0]).sort()).toEqual([
      'exercise',
      'order',
      'repsCompleted',
      'setNumber',
      'weightKg',
    ]);

    const trainerHistory = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${clientAccount.id}/workouts`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    const adminHistory = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${clientAccount.id}/workouts`)
      .set('Authorization', admin.authorization)
      .expect(200);
    expect(adminHistory.body).toEqual(trainerHistory.body);
    expect(
      trainerHistory.body.logs.map(
        (log: { templateCode: string }) => log.templateCode,
      ),
    ).toEqual([template.code, olderTemplate.code]);
    expect(JSON.stringify(trainerHistory.body)).not.toContain('recommendation');
    expect(JSON.stringify(trainerHistory.body)).not.toContain('storageKey');
    const older = trainerHistory.body.logs[1];
    expect(older.sets[0]).toMatchObject({
      repsCompleted: 8,
      weightKg: 20,
      exercise: { name: 'Тяга', nameEn: 'Row' },
    });

    const weights = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${clientAccount.id}/measurements`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    expect(weights.body.measurements[0].weightKg).toBe(64.5);
    const bareWeights = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${bare.id}/measurements`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    expect(bareWeights.body).toEqual({
      measurements: [],
      firstMeasurement: null,
    });

    const strength = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${clientAccount.id}/strength`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    expect(strength.body.changes).toEqual([
      expect.objectContaining({
        exerciseId: exercise.id,
        name: 'Тяга',
        nameEn: 'Row',
        fromKg: 20,
        toKg: 30,
      }),
    ]);

    const photos = await request(app.getHttpServer())
      .get(`/api/v1/coach/clients/${clientAccount.id}/progress-photos`)
      .set('Authorization', trainer.authorization)
      .expect(200);
    expect(Object.keys(photos.body.photos[0]).sort()).toEqual([
      'contentType',
      'createdAt',
      'height',
      'id',
      'width',
    ]);
    expect(JSON.stringify(photos.body)).not.toContain('storageKey');
    for (const authorization of [trainer.authorization, admin.authorization]) {
      const foreignPhoto = await request(app.getHttpServer())
        .get(
          `/api/v1/coach/clients/${clientAccount.id}/progress-photos/${otherPhoto}`,
        )
        .set('Authorization', authorization)
        .expect(404);
      expect(foreignPhoto.body.code).toBe('PHOTO_NOT_FOUND');
      expect(JSON.stringify(foreignPhoto.body)).not.toContain('storageKey');
    }
  });
});
