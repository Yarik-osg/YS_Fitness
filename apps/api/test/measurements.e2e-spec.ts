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

describeWithDatabase('weight measurements (e2e)', () => {
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
    await prisma.authRefreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.bodyMeasurement.deleteMany();
    await prisma.onboardingResponses.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  async function accessToken(email: string) {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(200);
    return login.body.tokens.accessToken as string;
  }

  it('lets an authenticated user without a subscription list and append measurements', async () => {
    const token = await accessToken('measurements@example.com');
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'measurements@example.com' },
    });
    expect(
      await prisma.subscription.count({ where: { userId: user.id } }),
    ).toBe(0);

    const created = await request(app.getHttpServer())
      .post('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: 70.5 })
      .expect(201);

    expect(typeof created.body.weightKg).toBe('number');
    expect(created.body.weightKg).toBe(70.5);
    expect(created.body.measuredAt).toEqual(expect.any(String));

    const again = await request(app.getHttpServer())
      .post('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: 70.5 })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listed.body.measurements).toHaveLength(2);
    expect(typeof listed.body.measurements[0].weightKg).toBe('number');
    expect(
      listed.body.measurements.map((row: { id: string }) => row.id),
    ).toEqual(expect.arrayContaining([created.body.id, again.body.id]));
    expect([created.body.id, again.body.id]).toContain(
      listed.body.firstMeasurement.id,
    );

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect([created.body.id, again.body.id]).toContain(
      me.body.bodyMeasurements[0].id,
    );
    expect(typeof me.body.bodyMeasurements[0].weightKg).toBe('string');
  });

  it('rejects a missing token and a body that is not exactly weightKg', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/me/measurements')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/users/me/measurements')
      .send({ weightKg: 70 })
      .expect(401);

    const token = await accessToken('strict@example.com');
    await request(app.getHttpServer())
      .post('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: '70.5' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: 70, measuredAt: '2020-01-01T00:00:00.000Z' })
      .expect(400);
  });

  it('does not return or overwrite another user measurement', async () => {
    const owner = await accessToken('owner@example.com');
    const other = await accessToken('other@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${owner}`)
      .send({ weightKg: 80 })
      .expect(201);

    const hidden = await request(app.getHttpServer())
      .get('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${other}`)
      .expect(200);
    expect(hidden.body.measurements).toEqual([]);
    expect(hidden.body.firstMeasurement).toBeNull();

    await request(app.getHttpServer())
      .post('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${other}`)
      .send({ weightKg: 90 })
      .expect(201);

    const ownerRows = await prisma.bodyMeasurement.findMany({
      where: {
        user: { email: 'owner@example.com' },
      },
    });
    expect(ownerRows).toHaveLength(1);
    expect(ownerRows[0]?.id).toBe(created.body.id);
  });

  it('orders equal timestamps by id for the chart, the first measurement, and the profile weight', async () => {
    const token = await accessToken('ties@example.com');
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'ties@example.com' },
    });
    const measuredAt = new Date('2026-05-31T12:00:00.000Z');
    const earlierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const laterId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await prisma.bodyMeasurement.createMany({
      data: [
        { id: laterId, userId: user.id, weightKg: 72, measuredAt },
        { id: earlierId, userId: user.id, weightKg: 71, measuredAt },
      ],
    });

    const listed = await request(app.getHttpServer())
      .get('/api/v1/users/me/measurements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      listed.body.measurements.map((row: { id: string }) => row.id),
    ).toEqual([laterId, earlierId]);
    expect(listed.body.firstMeasurement.id).toBe(earlierId);

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.bodyMeasurements[0].id).toBe(laterId);
    expect(typeof me.body.bodyMeasurements[0].weightKg).toBe('string');
    expect(Number(me.body.bodyMeasurements[0].weightKg)).toBe(72);
  });
});
