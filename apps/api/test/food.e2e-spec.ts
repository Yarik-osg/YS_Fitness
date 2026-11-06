import { BadGatewayException, type INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { vi } from 'vitest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';
import { OFF_CLIENT, type OffClient } from '../src/food-catalog/off-client.js';

const testDatabaseUrl = readTestDatabaseUrl() ?? '';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

const milk = {
  code: '11112222',
  product_name: 'Milk',
  nutriments: {
    'energy-kcal_100g': 50,
    proteins_100g: 10,
    fat_100g: 2,
    carbohydrates_100g: 8,
  },
};

describeWithDatabase('food catalog and log (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const off: OffClient = {
    search: vi.fn(async () => [
      milk,
      { ...milk, product_name: 'Milk again' },
      { code: '3333', product_name: 'Empty' },
    ]),
    barcode: vi.fn(async () => null),
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

  beforeEach(async () => {
    vi.mocked(off.search).mockReset();
    vi.mocked(off.search).mockResolvedValue([
      milk,
      { ...milk, product_name: 'Milk again' },
      { code: '3333', product_name: 'Empty' },
    ]);
    vi.mocked(off.barcode).mockReset();
    vi.mocked(off.barcode).mockResolvedValue(null);
    await prisma.foodLogEntry.deleteMany();
    await prisma.favoriteFood.deleteMany();
    await prisma.foodProduct.deleteMany();
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

  async function account(email: string) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash('strong-password'),
        role: UserRole.CLIENT,
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

  async function subscribe(userId: string) {
    const plan = await prisma.plan.create({
      data: {
        code: `FOOD_${userId.slice(0, 8)}`,
        name: 'Food e2e',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
      },
    });
    await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date('2027-06-01T00:00:00.000Z'),
      },
    });
  }

  it('requires a session and an active subscription', async () => {
    const open = await request(app.getHttpServer()).get(
      '/api/v1/food/products/search?q=milk',
    );
    expect(open.status).toBe(401);

    const user = await account('food-open@example.com');
    const denied = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', user.authorization);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('caches an Open Food Facts search, drops incomplete rows, and lists custom foods first', async () => {
    const user = await account('food-search@example.com');
    await subscribe(user.id);

    const first = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(off.search).toHaveBeenCalledTimes(1);
    expect(first.body.products).toEqual([
      expect.objectContaining({
        source: 'OFF',
        externalId: '11112222',
        name: 'Milk again',
        kcalPer100g: 50,
      }),
    ]);
    expect(
      await prisma.foodProduct.count({ where: { externalId: '11112222' } }),
    ).toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Milk pudding',
        kcalPer100g: 120,
        proteinPer100g: 4,
        fatPer100g: 3,
        carbsPer100g: 18,
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(off.search).toHaveBeenCalledTimes(1);
    expect(
      second.body.products.map((product: { source: string }) => product.source),
    ).toEqual(['CUSTOM', 'OFF']);

    vi.mocked(off.barcode).mockResolvedValue({
      code: '55556666',
      product_name: 'Yogurt',
      nutriments: {
        'energy-kcal_100g': 60,
        proteins_100g: 4,
        fat_100g: 2,
        carbohydrates_100g: 5,
      },
    });
    await request(app.getHttpServer())
      .get('/api/v1/food/products/search?barcode=55556666')
      .set('Authorization', user.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/food/products/search?barcode=55556666')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(off.barcode).toHaveBeenCalledTimes(1);

    vi.mocked(off.search).mockRejectedValue(
      new BadGatewayException({
        code: 'OFF_UNAVAILABLE',
        message: 'Food search is unavailable',
      }),
    );
    const down = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=zz')
      .set('Authorization', user.authorization);
    expect(down.status).toBe(502);
    expect(down.body.code).toBe('OFF_UNAVAILABLE');
    expect(JSON.stringify(down.body)).not.toContain('upstream');
  });

  it('favorites idempotently and only for a visible product', async () => {
    const user = await account('food-fav@example.com');
    const other = await account('food-fav-other@example.com');
    await subscribe(user.id);
    await subscribe(other.id);
    const created = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Oats',
        kcalPer100g: 370,
        proteinPer100g: 13,
        fatPer100g: 7,
        carbsPer100g: 60,
      })
      .expect(201);

    const hidden = await request(app.getHttpServer())
      .put(`/api/v1/food/favorites/${created.body.id}`)
      .set('Authorization', other.authorization);
    expect(hidden.status).toBe(404);
    expect(hidden.body.code).toBe('FOOD_PRODUCT_NOT_FOUND');

    await request(app.getHttpServer())
      .put(`/api/v1/food/favorites/${created.body.id}`)
      .set('Authorization', user.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/food/favorites/${created.body.id}`)
      .set('Authorization', user.authorization)
      .expect(200);
    expect(await prisma.favoriteFood.count()).toBe(1);
    const list = await request(app.getHttpServer())
      .get('/api/v1/food/favorites')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(list.body.products).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/food/favorites/${created.body.id}`)
      .set('Authorization', user.authorization)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/food/favorites/${created.body.id}`)
      .set('Authorization', user.authorization)
      .expect(204);
    expect(await prisma.favoriteFood.count()).toBe(0);
  });

  it('sums a day against the active target and keeps another user’s entry hidden', async () => {
    const user = await account('food-log@example.com');
    const other = await account('food-log-other@example.com');
    await subscribe(user.id);
    await subscribe(other.id);
    const searched = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', user.authorization)
      .expect(200);
    const productId = searched.body.products[0].id as string;
    const logged = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({ productId, grams: 100, meal: 'LUNCH', loggedOn: '2026-11-06' })
      .expect(201);
    expect(logged.body).toMatchObject({
      loggedOn: '2026-11-06',
      kcal: 50,
      protein: 10,
      fat: 2,
      carbs: 8,
    });
    await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({ productId, grams: 50, meal: 'SNACK', loggedOn: '2026-11-06' })
      .expect(201);

    const denied = await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${logged.body.id}`)
      .set('Authorization', other.authorization)
      .send({ grams: 10 });
    expect(denied.status).toBe(404);
    expect(denied.body.code).toBe('FOOD_ENTRY_NOT_FOUND');
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/food/log/${logged.body.id}`)
      .set('Authorization', other.authorization);
    expect(removed.status).toBe(404);
    expect(await prisma.foodLogEntry.count()).toBe(2);

    await prisma.nutritionTarget.create({
      data: {
        userId: user.id,
        active: true,
        source: 'MANUAL',
        targetCalories: 2000,
        proteinGrams: 150,
        fatGrams: 60,
        carbsGrams: 200,
      },
    });
    const day = await request(app.getHttpServer())
      .get('/api/v1/food/log?date=2026-11-06')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(day.body.totals).toEqual({
      kcal: 75,
      protein: 15,
      fat: 3,
      carbs: 12,
    });
    expect(day.body.target.source).toBe('MANUAL');
    expect(day.body.remaining).toEqual({
      kcal: 1925,
      protein: 135,
      fat: 57,
      carbs: 188,
    });

    const edited = await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${logged.body.id}`)
      .set('Authorization', user.authorization)
      .send({ kcal: 80, saveAsMyProduct: true })
      .expect(200);
    const offProduct = await prisma.foodProduct.findUniqueOrThrow({
      where: { id: productId },
    });
    const copy = await prisma.foodProduct.findUniqueOrThrow({
      where: { id: edited.body.productId },
    });
    expect(offProduct.source).toBe('OFF');
    expect(offProduct.kcalPer100g.toNumber()).toBe(50);
    expect(copy.source).toBe('CUSTOM');
    expect(copy.ownerId).toBe(user.id);
    expect(copy.basedOnProductId).toBe(productId);
    expect(copy.kcalPer100g.toNumber()).toBe(80);
    expect(edited.body.productId).not.toBe(productId);
    expect(edited.body.kcal).toBe(80);
  });
});
