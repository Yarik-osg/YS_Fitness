import { BadGatewayException, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { vi } from 'vitest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';
import { JwtService } from '@nestjs/jwt';
import {
  OFF_CLIENT,
  OpenFoodFactsHttp,
} from '../src/food-catalog/off-client.js';

const testDatabaseUrl = readTestDatabaseUrl() ?? '';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('food search limits (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const off = {
    search: vi.fn(async () => ({ status: 'ok' as const, value: [] })),
    barcode: vi.fn(async () => ({ status: 'ok' as const, value: null })),
  };

  beforeAll(async () => {
    configureE2eEnvironment(testDatabaseUrl);
    const [{ Test }, { AppModule }] = await Promise.all([
      import('@nestjs/testing'),
      import('../src/app.module.js'),
    ]);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OFF_CLIENT)
      .useValue(off)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
  });

  afterAll(async () => {
    await prisma.foodSearchQuery.deleteMany();
    await prisma.foodProduct.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.authRefreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
    await prisma?.$disconnect();
    await app?.close();
  });

  it('returns 429 on the 31st search within a minute', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'food-throttle@example.com',
        passwordHash: await hash('strong-password'),
        role: UserRole.CLIENT,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'food-throttle@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(200);
    const plan = await prisma.plan.create({
      data: {
        code: 'FOOD_THROTTLE',
        name: 'Food throttle',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
      },
    });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
    const authorization = `Bearer ${login.body.tokens.accessToken}`;
    const statuses: number[] = [];
    for (let i = 0; i < 31; i += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/food/products/search?q=throttle${i}`)
        .set('Authorization', authorization);
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  }, 20_000);
});

describeWithDatabase('food outbound limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const http = {
    search: vi.fn(),
    barcode: vi.fn(),
  };

  beforeAll(async () => {
    configureE2eEnvironment(testDatabaseUrl);
    const [{ Test }, { AppModule }] = await Promise.all([
      import('@nestjs/testing'),
      import('../src/app.module.js'),
    ]);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenFoodFactsHttp)
      .useValue(http)
      .overrideProvider(APP_GUARD)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    http.search.mockImplementation(async () => {
      const code = String(40000000 + http.search.mock.calls.length);
      return [
        {
          code,
          product_name: `Item ${code}`,
          nutriments: {
            'energy-kcal_100g': 40,
            proteins_100g: 1,
            fat_100g: 1,
            carbohydrates_100g: 1,
          },
        },
      ];
    });
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
  });

  afterAll(async () => {
    await prisma.foodProduct.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.authRefreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
    await prisma?.$disconnect();
    await app?.close();
  });

  async function member(email: string) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash('strong-password'),
        role: UserRole.CLIENT,
      },
    });
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        expiresAt: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
    const accessToken = await app.get(JwtService).signAsync(
      { sub: user.id, sessionId: session.id, role: user.role },
      {
        secret: 'test-access-secret-at-least-32-characters',
        expiresIn: 900,
      },
    );
    const plan = await prisma.plan.create({
      data: {
        code: `LIM_${user.id.slice(0, 8)}`,
        name: 'Food limit',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
      },
    });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
    return { authorization: `Bearer ${accessToken}` };
  }

  async function search(authorization: string, q: string) {
    return request(app.getHttpServer())
      .get(`/api/v1/food/products/search?q=${q}`)
      .set('Authorization', authorization);
  }

  it('stops the fourth new search for one user and still serves the next user', async () => {
    const first = await member('food-user-a@example.com');
    const second = await member('food-user-b@example.com');
    for (const q of ['alpha', 'beta', 'gamma']) {
      const found = await search(first.authorization, q);
      expect(found.status).toBe(200);
      expect(found.body.fromCacheOnly).toBe(false);
    }
    expect(http.search).toHaveBeenCalledTimes(3);
    const blocked = await search(first.authorization, 'delta');
    expect(blocked.status).toBe(200);
    expect(blocked.body.fromCacheOnly).toBe(true);
    expect(http.search).toHaveBeenCalledTimes(3);

    const other = await search(second.authorization, 'epsilon');
    expect(other.status).toBe(200);
    expect(other.body.fromCacheOnly).toBe(false);
    expect(http.search).toHaveBeenCalledTimes(4);
  });

  it('serves a fresh query from cache with no outbound call', async () => {
    await prisma.foodProduct.create({
      data: {
        source: 'OFF',
        externalId: '11110000',
        name: 'Cached milk',
        kcalPer100g: 50,
        proteinPer100g: 1,
        fatPer100g: 1,
        carbsPer100g: 1,
      },
    });
    await prisma.foodSearchQuery.create({
      data: { queryKey: 'cached', fetchedAt: new Date() },
    });
    const user = await member('food-cached@example.com');
    const calls = http.search.mock.calls.length;
    for (let i = 0; i < 20; i += 1) {
      const found = await search(user.authorization, 'cached');
      expect(found.status).toBe(200);
      expect(found.body.fromCacheOnly).toBe(false);
    }
    expect(http.search.mock.calls.length).toBe(calls);
  });

  it('does not record a query when Open Food Facts fails, and the call still counts', async () => {
    const user = await member('food-fail@example.com');
    http.search.mockRejectedValueOnce(
      new BadGatewayException({
        code: 'OFF_UNAVAILABLE',
        message: 'Food search is unavailable',
      }),
    );
    const failed = await search(user.authorization, 'broken');
    expect(failed.status).toBe(502);
    expect(
      await prisma.foodSearchQuery.count({ where: { queryKey: 'broken' } }),
    ).toBe(0);
    for (const q of ['broken-2', 'broken-3']) {
      expect((await search(user.authorization, q)).status).toBe(200);
    }
    const blocked = await search(user.authorization, 'broken-4');
    expect(blocked.status).toBe(200);
    expect(blocked.body.fromCacheOnly).toBe(true);
  });
});
