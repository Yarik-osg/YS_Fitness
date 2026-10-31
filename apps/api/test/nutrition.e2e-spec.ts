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

describeWithDatabase('nutrition profile and calculations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

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
    await prisma.nutritionTarget.deleteMany();
    await prisma.nutritionCalculation.deleteMany();
    await prisma.nutritionProfile.deleteMany();
    await prisma.subscription.deleteMany();
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

  async function account(email: string, role: UserRole = UserRole.CLIENT) {
    const user = await prisma.user.create({
      data: { email, passwordHash: await hash('strong-password'), role },
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

  async function subscribe(userId: string, planId: string) {
    await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
  }

  it('keeps a calculation on the caller and rejects a coach', async () => {
    const client = await account('nutrition-client@example.com');
    const other = await account('nutrition-other@example.com');
    const coach = await account('nutrition-coach@example.com', UserRole.ADMIN);
    const plan = await prisma.plan.create({
      data: {
        code: 'NUTRITION_E2E',
        name: 'Nutrition e2e',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
      },
    });
    await subscribe(client.id, plan.id);
    await subscribe(other.id, plan.id);
    await subscribe(coach.id, plan.id);

    await prisma.userProfile.create({
      data: {
        userId: client.id,
        dateOfBirth: new Date('1996-11-01T00:00:00.000Z'),
        biologicalSexForCalculation: 'FEMALE',
        heightCm: '165',
        activityLevel: 'MODERATELY_ACTIVE',
        goal: 'MAINTAIN_WEIGHT',
        timezone: 'UTC',
      },
    });
    await prisma.bodyMeasurement.create({
      data: { userId: client.id, weightKg: '60' },
    });
    await prisma.onboardingResponses.create({
      data: {
        userId: client.id,
        programTrack: 'FEMALE',
        currentBody: '0',
        desiredBody: '1',
        mainGoal: 'GET_STRONGER',
        experience: 'INTERMEDIATE',
        trainingFrequency: '3',
        focusAreas: ['glutes'],
        nutritionCurrent: 'BALANCED',
        mealsPerDay: '3',
        eatingHabits: [],
      },
    });

    const blocked = await request(app.getHttpServer())
      .put('/api/v1/nutrition/profile')
      .send({ activity: 'MODERATE', goal: 'LOSE_WEIGHT', mealCount: 3 });
    expect(blocked.status).toBe(401);

    const unsubscribed = await account('nutrition-open@example.com');
    const denied = await request(app.getHttpServer())
      .put('/api/v1/nutrition/profile')
      .set('Authorization', unsubscribed.authorization)
      .send({ activity: 'MODERATE', goal: 'LOSE_WEIGHT', mealCount: 3 });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('SUBSCRIPTION_REQUIRED');

    const saved = await request(app.getHttpServer())
      .put('/api/v1/nutrition/profile')
      .set('Authorization', client.authorization)
      .send({
        activity: 'LIGHTLY_ACTIVE',
        goal: 'LOSE_WEIGHT',
        mealCount: 3,
      });
    expect(saved.status).toBe(400);

    const profile = await request(app.getHttpServer())
      .put('/api/v1/nutrition/profile')
      .set('Authorization', client.authorization)
      .send({ activity: 'MODERATE', goal: 'LOSE_WEIGHT', mealCount: 3 })
      .expect(200);
    expect(profile.body.activity).toBe('MODERATE');

    const created = await request(app.getHttpServer())
      .post('/api/v1/nutrition/calculations')
      .set('Authorization', client.authorization)
      .expect(201);
    expect(created.body.activatedTarget).toBe(true);
    expect(created.body.activityMultiplier).toBe('1.55');
    expect(created.body.goalAdjustment).toBe('-0.15');

    const mine = await request(app.getHttpServer())
      .get('/api/v1/nutrition/calculations')
      .set('Authorization', client.authorization)
      .expect(200);
    expect(mine.body.calculations).toHaveLength(1);

    const theirs = await request(app.getHttpServer())
      .get('/api/v1/nutrition/calculations')
      .set('Authorization', other.authorization)
      .expect(200);
    expect(theirs.body.calculations).toEqual([]);
    const otherProfile = await request(app.getHttpServer())
      .get('/api/v1/nutrition/profile')
      .set('Authorization', other.authorization)
      .expect(200);
    expect(otherProfile.body.profile).toBeNull();

    const coachRead = await request(app.getHttpServer())
      .get('/api/v1/nutrition/profile')
      .set('Authorization', coach.authorization);
    expect(coachRead.status).toBe(404);
    expect(coachRead.body.code).toBe('CLIENT_NOT_FOUND');
    const coachWrite = await request(app.getHttpServer())
      .post('/api/v1/nutrition/calculations')
      .set('Authorization', coach.authorization);
    expect(coachWrite.status).toBe(404);
    expect(coachWrite.body.code).toBe('CLIENT_NOT_FOUND');
    expect(
      await prisma.nutritionCalculation.count({ where: { userId: coach.id } }),
    ).toBe(0);
    expect(
      await prisma.nutritionCalculation.count({ where: { userId: client.id } }),
    ).toBe(1);
  });
});
