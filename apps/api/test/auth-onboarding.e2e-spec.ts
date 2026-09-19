import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';

const testDatabaseUrl = readTestDatabaseUrl() ?? '';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('auth and onboarding (e2e)', () => {
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
    await prisma.authRefreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.bodyMeasurement.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('registers, logs in, rotates once, and revokes on replay', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'CLIENT@EXAMPLE.COM',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    expect(registration.body.user.email).toBe('client@example.com');
    expect(registration.body.tokens.refreshToken).toBeTypeOf('string');

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'client@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(409);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'client@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(200);

    const firstRefreshToken = login.body.tokens.refreshToken as string;
    const rotation = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
        clientType: 'MOBILE',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
        clientType: 'MOBILE',
      })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${rotation.body.tokens.accessToken}`)
      .expect(401);
  });

  it('protects browser refresh with origin and double-submit CSRF', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'web@example.com',
        password: 'strong-password',
        clientType: 'WEB',
      })
      .expect(201);

    const cookies = registration.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith('ys_refresh='),
    );
    const csrfCookie = cookies.find((cookie) =>
      cookie.startsWith('ys_refresh_csrf='),
    );
    const csrfToken = csrfCookie?.split(';')[0]?.split('=')[1];

    expect(refreshCookie).toBeDefined();
    expect(csrfToken).toBeDefined();
    expect(registration.body.tokens.refreshToken).toBeUndefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie!, csrfCookie!])
      .send({ clientType: 'WEB' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', csrfToken!)
      .set('Cookie', [refreshCookie!, csrfCookie!])
      .send({ clientType: 'WEB' })
      .expect(200);
  });

  it('upserts onboarding and does not duplicate an unchanged weight', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'onboarding@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);

    const authorization = `Bearer ${registration.body.tokens.accessToken}`;
    const input = {
      dateOfBirth: '1990-05-10',
      biologicalSexForCalculation: 'FEMALE',
      heightCm: 168,
      weightKg: 67.5,
      bodyFatPercent: 24,
      activityLevel: 'MODERATELY_ACTIVE',
      goal: 'LOSE_WEIGHT',
      healthRestrictions: [{ type: 'knee_injury' }],
      timezone: 'Europe/Kyiv',
    };

    await request(app.getHttpServer())
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', authorization)
      .send(input)
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', authorization)
      .send(input)
      .expect(200);

    expect(await prisma.userProfile.count()).toBe(1);
    expect(await prisma.bodyMeasurement.count()).toBe(1);
  });
});
