import type { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';
import { MockPaymentProvider } from '../src/subscriptions/providers/mock-payment-provider.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../src/subscriptions/providers/payment-provider.interface.js';
import { FEMALE_ONBOARDING } from './onboarding.fixture.js';

const testDatabaseUrl = readTestDatabaseUrl() ?? '';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

class FailOnceProvider implements PaymentProvider {
  failNext = false;
  private readonly mock = new MockPaymentProvider();

  createCheckout(input: Parameters<PaymentProvider['createCheckout']>[0]) {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('provider unavailable'));
    }
    return this.mock.createCheckout(input);
  }
}

describeWithDatabase('subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const paymentProvider = new FailOnceProvider();

  async function createUser(email: string, role: UserRole = UserRole.CLIENT) {
    const user = await prisma.user.create({
      data: { email, passwordHash: await hash('strong-password'), role },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strong-password', clientType: 'MOBILE' })
      .expect(200);
    return {
      userId: user.id,
      authorization: `Bearer ${login.body.tokens.accessToken}`,
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
    })
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(paymentProvider)
      .compile();

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
    await prisma.onboardingResponses.deleteMany();
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
        {
          code: 'FULL_ACCESS',
          name: 'FULL ACCESS',
          priceAmount: 349_000,
          currency: 'UAH',
          intervalMonths: 3,
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('lists three active catalog plans', async () => {
    const plans = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/plans')
      .expect(200);

    expect(plans.body).toHaveLength(3);
    expect(plans.body.map((plan: { code: string }) => plan.code)).toEqual([
      '3_MONTHS',
      'FULL_ACCESS',
      '1_MONTH',
    ]);
    expect(
      plans.body.find((plan: { code: string }) => plan.code === 'FULL_ACCESS'),
    ).toMatchObject({
      name: 'FULL ACCESS',
      priceAmount: 349_000,
      intervalMonths: 3,
      isActive: true,
    });
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
      .send(FEMALE_ONBOARDING)
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

  it('registers, onboard, and checkouts FULL_ACCESS end to end', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'full-access@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    const authorization = `Bearer ${registration.body.tokens.accessToken}`;
    await request(app.getHttpServer())
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', authorization)
      .send(FEMALE_ONBOARDING)
      .expect(200);

    const fullAccess = await prisma.plan.findUniqueOrThrow({
      where: { code: 'FULL_ACCESS' },
    });

    const checkout = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', authorization)
      .send({ planId: fullAccess.id })
      .expect(201);

    expect(checkout.body.subscription.status).toBe('ACTIVE');
    expect(checkout.body.subscription.plan.code).toBe('FULL_ACCESS');
    expect(checkout.body.subscription.plan.priceAmount).toBe(349_000);
    expect(checkout.body.subscription.plan.intervalMonths).toBe(3);
    expect(checkout.body.checkoutUrl).toBeNull();

    const mine = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', authorization)
      .expect(200);

    expect(mine.body.subscription.status).toBe('ACTIVE');
    expect(mine.body.subscription.plan.code).toBe('FULL_ACCESS');
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

  it('leaves no row when the provider fails and lets a retry succeed', async () => {
    const { userId, authorization } = await createUser(
      'provider-failure@example.com',
    );
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: '1_MONTH' },
    });

    paymentProvider.failNext = true;
    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', authorization)
      .send({ planId: plan.id })
      .expect(500);
    expect(await prisma.subscription.count({ where: { userId } })).toBe(0);

    const retry = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', authorization)
      .send({ planId: plan.id })
      .expect(201);
    expect(retry.body.subscription.status).toBe('ACTIVE');
  });

  it('expires a lapsed subscription on read and allows a new checkout', async () => {
    const { userId, authorization } = await createUser('lapsed@example.com');
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: '1_MONTH' },
    });

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', authorization)
      .send({ planId: plan.id })
      .expect(201);
    await prisma.subscription.updateMany({
      where: { userId },
      data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
    });

    const mine = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', authorization)
      .expect(200);
    expect(mine.body).toEqual({ subscription: null });

    const renewed = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', authorization)
      .send({ planId: plan.id })
      .expect(201);
    expect(renewed.body.subscription.status).toBe('ACTIVE');

    const statuses = await prisma.subscription.findMany({
      where: { userId },
      select: { status: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(statuses.map((row) => row.status)).toEqual(['EXPIRED', 'ACTIVE']);
  });

  it('rejects a grant whose expiresAt is in the past', async () => {
    const { id: userId } = await prisma.user.create({
      data: {
        email: 'past-grant@example.com',
        passwordHash: await hash('strong-password'),
      },
    });
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: '3_MONTHS' },
    });
    const trainer = await createUser(
      'trainer-past-grant@example.com',
      UserRole.TRAINER,
    );

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/grant')
      .set('Authorization', trainer.authorization)
      .send({
        userId,
        planId: plan.id,
        expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .expect(400);
    expect(await prisma.subscription.count({ where: { userId } })).toBe(0);
  });
});
