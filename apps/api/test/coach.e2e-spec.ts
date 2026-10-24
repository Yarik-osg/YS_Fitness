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
});
