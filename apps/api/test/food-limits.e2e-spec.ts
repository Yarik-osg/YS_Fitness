import type { INestApplication } from '@nestjs/common';
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
import {
  OFF_CLIENT,
  OpenFoodFactsHttp,
} from '../src/food-catalog/off-client.js';
import { OffOutboundLimiter } from '../src/food-catalog/off-limiter.js';

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

  it('returns 429 on the 11th search within a minute', async () => {
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
    for (let i = 0; i < 11; i += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/food/products/search?q=throttle${i}`)
        .set('Authorization', authorization);
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
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
    const limiter = app.get(OffOutboundLimiter);
    for (let i = 0; i < 10; i += 1) limiter.trySearch();
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

  it('returns local results and does not call Open Food Facts when the budget is spent', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'food-budget@example.com',
        passwordHash: await hash('strong-password'),
        role: UserRole.CLIENT,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'food-budget@example.com',
        password: 'strong-password',
        clientType: 'MOBILE',
      })
      .expect(200);
    const plan = await prisma.plan.create({
      data: {
        code: 'FOOD_BUDGET',
        name: 'Food budget',
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

    const found = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=cached')
      .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
      .expect(200);

    expect(found.body.fromCacheOnly).toBe(true);
    expect(found.body.products).toEqual([
      expect.objectContaining({ name: 'Cached milk', source: 'OFF' }),
    ]);
    expect(http.search).not.toHaveBeenCalled();
  });
});
