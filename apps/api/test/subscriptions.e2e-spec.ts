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

const ONBOARDING = {
  dateOfBirth: '1990-05-10',
  biologicalSexForCalculation: 'FEMALE',
  heightCm: 168,
  weightKg: 67.5,
  activityLevel: 'MODERATELY_ACTIVE',
  goal: 'LOSE_WEIGHT',
  timezone: 'Europe/Kyiv',
};

describeWithDatabase('subscriptions (e2e)', () => {
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
    await prisma.subscription.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.authRefreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.bodyMeasurement.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    await prisma.plan.createMany({
      data: [
        {
          code: '3_MONTHS',
          name: '3 months',
          priceAmount: 249_000,
          currency: 'UAH',
          intervalMonths: 3,
          isActive: true,
        },
        {
          code: '1_MONTH',
          name: '1 month',
          priceAmount: 99_000,
          currency: 'UAH',
          intervalMonths: 1,
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('registers, onboard, checkouts, and returns the active subscription', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'subscriber@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    const authorization = `Bearer ${registration.body.tokens.accessToken}`;
    await request(app.getHttpServer())
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', authorization)
      .send(ONBOARDING)
      .expect(200);

    const plans = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/plans')
      .expect(200);
    const monthly = plans.body.find(
      (plan: { code: string }) => plan.code === '1_MONTH',
    );
    expect(monthly).toBeDefined();

    const mineBefore = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', authorization)
      .expect(200);
    expect(mineBefore.body).toEqual({ subscription: null });

    const checkout = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', authorization)
      .send({ planId: monthly.id })
      .expect(201);

    expect(checkout.body.subscription.status).toBe('ACTIVE');
    expect(checkout.body.subscription.plan.code).toBe('1_MONTH');
    expect(checkout.body.checkoutUrl).toBeNull();

    const mine = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', authorization)
      .expect(200);

    expect(mine.body.subscription.status).toBe('ACTIVE');
    expect(mine.body.subscription.plan.code).toBe('1_MONTH');
  });

  it('lets only one of two concurrent checkouts succeed', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'race@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    const authorization = `Bearer ${registration.body.tokens.accessToken}`;
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: '1_MONTH' },
    });

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', authorization)
        .send({ planId: plan.id }),
      request(app.getHttpServer())
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', authorization)
        .send({ planId: plan.id }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const conflict = first.status === 409 ? first : second;
    const created = first.status === 201 ? first : second;
    expect(created.body.subscription.status).toBe('ACTIVE');
    expect(conflict.body.code).toBe('SUBSCRIPTION_ALREADY_ACTIVE');
    expect(await prisma.subscription.count()).toBe(1);
  });

  it('rejects a client grant and records grantedByUserId for a trainer', async () => {
    const client = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'client-grant@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: '3_MONTHS' },
    });

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/grant')
      .set('Authorization', `Bearer ${client.body.tokens.accessToken}`)
      .send({ userId: client.body.user.id, planId: plan.id })
      .expect(403);

    const trainer = await prisma.user.create({
      data: {
        email: 'trainer-grant@example.com',
        passwordHash: await hash('strong-password'),
        role: UserRole.TRAINER,
      },
    });
    const trainerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: trainer.email,
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(200);

    const granted = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/grant')
      .set('Authorization', `Bearer ${trainerLogin.body.tokens.accessToken}`)
      .send({ userId: client.body.user.id, planId: plan.id })
      .expect(201);

    expect(granted.body.status).toBe('ACTIVE');
    expect(granted.body.provider).toBe('MANUAL');
    expect(granted.body.grantedByUserId).toBe(trainer.id);

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/grant')
      .set('Authorization', `Bearer ${trainerLogin.body.tokens.accessToken}`)
      .send({ userId: client.body.user.id, planId: plan.id })
      .expect(409)
      .expect((response) => {
        expect(response.body.code).toBe('SUBSCRIPTION_ALREADY_ACTIVE');
      });
  });
});
