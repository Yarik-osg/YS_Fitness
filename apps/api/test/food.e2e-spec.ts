import { BadGatewayException, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { vi } from 'vitest';
import {
  configureE2eEnvironment,
  readTestDatabaseUrl,
} from '../src/config/test-environment.js';
import { normalizeBarcode } from '@repo/validation';
import { FoodCatalogRepository } from '../src/food-catalog/food-catalog.repository.js';
import { OFF_CLIENT, type OffLookup } from '../src/food-catalog/off-client.js';

function validEan13(): string {
  for (let value = 10 ** 12; value < 10 ** 12 + 200_000; value += 1) {
    const code = String(value);
    if (normalizeBarcode(code) === code) return code;
  }
  throw new Error('no valid barcode');
}

const yogurtCode = validEan13();

function anotherEan13(taken: string): string {
  for (let value = 10 ** 12; value < 10 ** 12 + 200_000; value += 1) {
    const code = String(value);
    if (code !== taken && normalizeBarcode(code) === code) return code;
  }
  throw new Error('no second barcode');
}

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
  const off = {
    search: vi.fn(async (): Promise<OffLookup<unknown[]>> => ({
      status: 'ok',
      value: [
        milk,
        { ...milk, product_name: 'Milk again' },
        { code: '3333', product_name: 'Empty' },
      ],
    })),
    barcode: vi.fn(async (): Promise<OffLookup<unknown>> => ({
      status: 'ok',
      value: null,
    })),
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
      .overrideProvider(APP_GUARD)
      .useValue({ canActivate: () => true })
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
    vi.mocked(off.search).mockResolvedValue({
      status: 'ok',
      value: [
        milk,
        { ...milk, product_name: 'Milk again' },
        { code: '3333', product_name: 'Empty' },
      ],
    });
    vi.mocked(off.barcode).mockReset();
    vi.mocked(off.barcode).mockResolvedValue({ status: 'ok', value: null });
    await prisma.foodSearchQuery.deleteMany();
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
    return { id: user.id, authorization: `Bearer ${accessToken}` };
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

  it('caches an Open Food Facts search, drops incomplete rows, and ranks an exact name first', async () => {
    const user = await account('food-search@example.com');
    await subscribe(user.id);

    const first = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(off.search).toHaveBeenCalledTimes(1);
    expect(first.body.fromCacheOnly).toBe(false);
    expect(first.body.products).toEqual([
      expect.objectContaining({
        source: 'OFF',
        externalId: '11112222',
        name: 'Milk',
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
    expect(second.body.fromCacheOnly).toBe(false);
    await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=MILK')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(off.search).toHaveBeenCalledTimes(1);
    expect(
      await prisma.foodSearchQuery.count({ where: { queryKey: 'milk' } }),
    ).toBe(1);
    expect(
      second.body.products.map((product: { name: string }) => product.name),
    ).toEqual(['Milk', 'Milk pudding']);

    vi.mocked(off.barcode).mockResolvedValue({
      status: 'ok',
      value: {
        code: yogurtCode,
        product_name: 'Yogurt',
        nutriments: {
          'energy-kcal_100g': 60,
          proteins_100g: 4,
          fat_100g: 2,
          carbohydrates_100g: 5,
        },
      },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/food/products/search?barcode=${yogurtCode}`)
      .set('Authorization', user.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/food/products/search?barcode=${yogurtCode}`)
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
    expect(
      await prisma.foodSearchQuery.count({ where: { queryKey: 'zz' } }),
    ).toBe(0);
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
    const summed = (
      day.body.entries as {
        kcal: number;
        protein: number;
        fat: number;
        carbs: number;
      }[]
    ).reduce(
      (sum, entry) => ({
        kcal: sum.kcal + entry.kcal,
        protein: sum.protein + entry.protein,
        fat: sum.fat + entry.fat,
        carbs: sum.carbs + entry.carbs,
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    );
    expect(day.body.totals).toEqual(summed);
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

  it('logs the maximum grams of a product at the per-100g caps', async () => {
    const user = await account('food-max@example.com');
    await subscribe(user.id);
    const created = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Oil',
        kcalPer100g: 1000,
        proteinPer100g: 100,
        fatPer100g: 100,
        carbsPer100g: 100,
      })
      .expect(201);
    const logged = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: created.body.id,
        grams: 5000,
        meal: 'DINNER',
        loggedOn: '2026-11-06',
      })
      .expect(201);
    expect(logged.body).toMatchObject({
      kcal: 50000,
      protein: 5000,
      fat: 5000,
      carbs: 5000,
    });
  });

  it('rejects a patch whose values are too large for the grams', async () => {
    const user = await account('food-range@example.com');
    await subscribe(user.id);
    const created = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Crumb',
        kcalPer100g: 100,
        proteinPer100g: 1,
        fatPer100g: 1,
        carbsPer100g: 1,
      })
      .expect(201);
    const logged = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: created.body.id,
        grams: 0.1,
        meal: 'SNACK',
        loggedOn: '2026-11-06',
      })
      .expect(201);
    const overEntryCap = await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${logged.body.id}`)
      .set('Authorization', user.authorization)
      .send({ kcal: 99999.9, saveAsMyProduct: true });
    expect(overEntryCap.status).toBe(400);
    const overGramCap = await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${logged.body.id}`)
      .set('Authorization', user.authorization)
      .send({ kcal: 50000, saveAsMyProduct: true });
    expect(overGramCap.status).toBe(400);
    expect(overGramCap.body.code).toBe('FOOD_VALUES_OUT_OF_RANGE');
    expect(
      await prisma.foodProduct.count({
        where: { source: 'CUSTOM', name: 'Crumb' },
      }),
    ).toBe(1);
  });

  it('keeps a grams-only scale up to 5000 g inside the cap', async () => {
    const user = await account('food-scale@example.com');
    await subscribe(user.id);
    const created = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Dense',
        kcalPer100g: 1000,
        proteinPer100g: 100,
        fatPer100g: 100,
        carbsPer100g: 100,
      })
      .expect(201);
    const logged = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: created.body.id,
        grams: 1,
        meal: 'LUNCH',
        loggedOn: '2026-11-06',
      })
      .expect(201);
    const scaled = await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${logged.body.id}`)
      .set('Authorization', user.authorization)
      .send({ grams: 5000 })
      .expect(200);
    expect(scaled.body).toMatchObject({
      grams: 5000,
      kcal: 50000,
      protein: 5000,
      fat: 5000,
      carbs: 5000,
    });
  });

  it('returns the valid Open Food Facts product and drops the absurd one', async () => {
    const user = await account('food-absurd@example.com');
    await subscribe(user.id);
    vi.mocked(off.search).mockResolvedValue({
      status: 'ok',
      value: [
        {
          code: '99990001',
          product_name: 'Absurd yogurt',
          nutriments: {
            'energy-kcal_100g': 1e7,
            proteins_100g: 1,
            fat_100g: 1,
            carbohydrates_100g: 1,
          },
        },
        {
          code: '99990002',
          product_name: 'Plain yogurt',
          nutriments: {
            'energy-kcal_100g': 60,
            proteins_100g: 4,
            fat_100g: 2,
            carbohydrates_100g: 5,
          },
        },
      ],
    });
    const found = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=yogurt')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(found.body.products).toEqual([
      expect.objectContaining({ externalId: '99990002', name: 'Plain yogurt' }),
    ]);
    expect(
      await prisma.foodProduct.count({ where: { externalId: '99990001' } }),
    ).toBe(0);
  });

  it('edits one entry from two parallel personal copies without an error', async () => {
    const user = await account('food-race@example.com');
    await subscribe(user.id);
    const created = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Race',
        kcalPer100g: 100,
        proteinPer100g: 10,
        fatPer100g: 5,
        carbsPer100g: 10,
      })
      .expect(201);
    const logged = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: created.body.id,
        grams: 100,
        meal: 'LUNCH',
        loggedOn: '2026-11-06',
      })
      .expect(201);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/food/log/${logged.body.id}`)
        .set('Authorization', user.authorization)
        .send({ kcal: 80, saveAsMyProduct: true }),
      request(app.getHttpServer())
        .patch(`/api/v1/food/log/${logged.body.id}`)
        .set('Authorization', user.authorization)
        .send({ kcal: 90, saveAsMyProduct: true }),
    ]);
    expect(
      [first.status, second.status].every((status) => status === 200),
    ).toBe(true);
    const row = await prisma.foodLogEntry.findUniqueOrThrow({
      where: { id: logged.body.id },
    });
    expect(row.productId).toEqual(expect.any(String));
    const product = await prisma.foodProduct.findUnique({
      where: { id: row.productId ?? '' },
    });
    expect(product?.source).toBe('CUSTOM');
    expect(product?.ownerId).toBe(user.id);
  });

  it('marks favorites for the caller only and lists them newest first', async () => {
    const user = await account('food-flag@example.com');
    const other = await account('food-flag-other@example.com');
    await subscribe(user.id);
    await subscribe(other.id);
    const first = await request(app.getHttpServer())
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
    expect(first.body.isFavorite).toBe(false);
    const shared = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', user.authorization)
      .expect(200);
    const sharedId = shared.body.products[0].id as string;
    await request(app.getHttpServer())
      .put(`/api/v1/food/favorites/${first.body.id}`)
      .set('Authorization', user.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/food/favorites/${sharedId}`)
      .set('Authorization', user.authorization)
      .expect(200);
    await prisma.favoriteFood.update({
      where: {
        userId_productId: { userId: user.id, productId: first.body.id },
      },
      data: { createdAt: new Date('2026-11-01T00:00:00.000Z') },
    });
    await prisma.favoriteFood.update({
      where: { userId_productId: { userId: user.id, productId: sharedId } },
      data: { createdAt: new Date('2026-11-02T00:00:00.000Z') },
    });
    const before = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', other.authorization)
      .expect(200);
    expect(
      before.body.products.find(
        (product: { id: string }) => product.id === sharedId,
      ).isFavorite,
    ).toBe(false);
    await request(app.getHttpServer())
      .put(`/api/v1/food/favorites/${sharedId}`)
      .set('Authorization', other.authorization)
      .expect(200);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', user.authorization)
      .expect(200);
    const theirs = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=milk')
      .set('Authorization', other.authorization)
      .expect(200);
    expect(
      mine.body.products.find(
        (product: { id: string }) => product.id === sharedId,
      ).isFavorite,
    ).toBe(true);
    expect(
      theirs.body.products.find(
        (product: { id: string }) => product.id === sharedId,
      ).isFavorite,
    ).toBe(true);
    const oats = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?q=oats')
      .set('Authorization', other.authorization)
      .expect(200);
    expect(
      oats.body.products.find(
        (product: { id: string }) => product.id === first.body.id,
      ),
    ).toBeUndefined();

    const list = await request(app.getHttpServer())
      .get('/api/v1/food/favorites')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(
      list.body.products.map((product: { id: string }) => product.id),
    ).toEqual([sharedId, first.body.id]);
    expect(
      list.body.products.every(
        (product: { isFavorite: boolean }) => product.isFavorite,
      ),
    ).toBe(true);
  });

  it('lists recent products from the product row, not the entry snapshot', async () => {
    const open = await request(app.getHttpServer()).get('/api/v1/food/recent');
    expect(open.status).toBe(401);
    const bare = await account('food-recent-open@example.com');
    const denied = await request(app.getHttpServer())
      .get('/api/v1/food/recent')
      .set('Authorization', bare.authorization);
    expect(denied.status).toBe(403);

    const user = await account('food-recent@example.com');
    const other = await account('food-recent-other@example.com');
    await subscribe(user.id);
    await subscribe(other.id);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/food/recent?limit=0')
          .set('Authorization', user.authorization)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/food/recent?limit=51')
          .set('Authorization', user.authorization)
      ).status,
    ).toBe(400);

    const riceCode = anotherEan13(yogurtCode);
    const created = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Rice',
        barcode: riceCode,
        kcalPer100g: 130,
        proteinPer100g: 3,
        fatPer100g: 1,
        carbsPer100g: 28,
      })
      .expect(201);
    const otherProduct = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', other.authorization)
      .send({
        name: 'Secret',
        kcalPer100g: 10,
        proteinPer100g: 1,
        fatPer100g: 1,
        carbsPer100g: 1,
      })
      .expect(201);
    const first = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: created.body.id,
        grams: 100,
        meal: 'LUNCH',
        loggedOn: '2026-11-01',
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: created.body.id,
        grams: 80,
        meal: 'SNACK',
        loggedOn: '2026-11-02',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: created.body.id,
        grams: 40,
        meal: 'BREAKFAST',
        loggedOn: '2026-11-03',
      })
      .expect(201);
    await prisma.foodLogEntry.update({
      where: { id: first.body.id },
      data: { productId: null },
    });
    await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', other.authorization)
      .send({
        productId: otherProduct.body.id,
        grams: 20,
        meal: 'DINNER',
        loggedOn: '2026-11-04',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${second.body.id}`)
      .set('Authorization', user.authorization)
      .send({ kcal: 40, saveAsMyProduct: true })
      .expect(200);

    const recent = await request(app.getHttpServer())
      .get('/api/v1/food/recent?limit=1')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(recent.body.items).toHaveLength(1);

    const all = await request(app.getHttpServer())
      .get('/api/v1/food/recent')
      .set('Authorization', user.authorization)
      .expect(200);
    expect(all.body.items).toHaveLength(2);
    expect(
      all.body.items.map(
        (item: { product: { name: string } }) => item.product.name,
      ),
    ).toEqual(['Rice', 'Rice']);
    const original = all.body.items[0];
    const copy = all.body.items[1];
    expect(original.product.id).toBe(created.body.id);
    expect(original.product.barcode).toBe(riceCode);
    expect(original.product.kcalPer100g).toBe(130);
    expect(original.lastGrams).toBe(40);
    expect(original.lastMeal).toBe('BREAKFAST');
    expect(original.lastLoggedOn).toBe('2026-11-03');
    expect(copy.product.id).not.toBe(created.body.id);
    expect(copy.product.barcode).toBeNull();
    expect(copy.product.kcalPer100g).toBe(50);
    expect(copy.lastGrams).toBe(80);
    expect(copy.lastMeal).toBe('SNACK');
    expect(copy.lastLoggedOn).toBe('2026-11-02');
    expect(
      all.body.items.some(
        (item: { product: { name: string } }) => item.product.name === 'Secret',
      ),
    ).toBe(false);
  });

  it('keeps a custom barcode per user and copies an Open Food Facts code once', async () => {
    const user = await account('food-barcode@example.com');
    const other = await account('food-barcode-other@example.com');
    await subscribe(user.id);
    await subscribe(other.id);
    const code = anotherEan13(yogurtCode);
    const invalid = await request(app.getHttpServer())
      .get('/api/v1/food/products/search?barcode=55556666')
      .set('Authorization', user.authorization);
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('INVALID_BARCODE');

    const created = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'My oats',
        barcode: code,
        kcalPer100g: 140,
        proteinPer100g: 5,
        fatPer100g: 3,
        carbsPer100g: 24,
      })
      .expect(201);
    expect(created.body.barcode).toBe(code);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', user.authorization)
      .send({
        name: 'Oats again',
        barcode: ` ${code} `,
        kcalPer100g: 140,
        proteinPer100g: 5,
        fatPer100g: 3,
        carbsPer100g: 24,
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('BARCODE_ALREADY_USED');

    const shared = await request(app.getHttpServer())
      .post('/api/v1/food/products')
      .set('Authorization', other.authorization)
      .send({
        name: 'Their oats',
        barcode: code,
        kcalPer100g: 141,
        proteinPer100g: 5,
        fatPer100g: 3,
        carbsPer100g: 24,
      })
      .expect(201);

    vi.mocked(off.barcode).mockResolvedValue({
      status: 'ok',
      value: {
        code,
        product_name: 'Should not win',
        nutriments: {
          'energy-kcal_100g': 10,
          proteins_100g: 1,
          fat_100g: 1,
          carbohydrates_100g: 1,
        },
      },
    });
    const mine = await request(app.getHttpServer())
      .get(`/api/v1/food/products/search?barcode=${code}&q=ignored`)
      .set('Authorization', user.authorization)
      .expect(200);
    const theirs = await request(app.getHttpServer())
      .get(`/api/v1/food/products/search?barcode=${code}`)
      .set('Authorization', other.authorization)
      .expect(200);
    expect(off.barcode).not.toHaveBeenCalled();
    expect(
      mine.body.products.map((product: { id: string }) => product.id),
    ).toEqual([created.body.id]);
    expect(
      theirs.body.products.map((product: { id: string }) => product.id),
    ).toEqual([shared.body.id]);

    vi.mocked(off.barcode).mockResolvedValue({
      status: 'ok',
      value: {
        code: yogurtCode,
        product_name: 'Yogurt',
        nutriments: {
          'energy-kcal_100g': 60,
          proteins_100g: 4,
          fat_100g: 2,
          carbohydrates_100g: 5,
        },
      },
    });
    const found = await request(app.getHttpServer())
      .get(`/api/v1/food/products/search?barcode=${yogurtCode}`)
      .set('Authorization', user.authorization)
      .expect(200);
    expect(found.body.products[0].barcode).toBe(yogurtCode);
    const logged = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: found.body.products[0].id,
        grams: 100,
        meal: 'LUNCH',
        loggedOn: '2026-11-05',
      })
      .expect(201);
    const copied = await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${logged.body.id}`)
      .set('Authorization', user.authorization)
      .send({ kcal: 70, saveAsMyProduct: true })
      .expect(200);
    const firstCopy = await prisma.foodProduct.findUniqueOrThrow({
      where: { id: copied.body.productId },
    });
    expect(firstCopy.barcode).toBe(yogurtCode);

    const again = await request(app.getHttpServer())
      .post('/api/v1/food/log')
      .set('Authorization', user.authorization)
      .send({
        productId: found.body.products[0].id,
        grams: 100,
        meal: 'DINNER',
        loggedOn: '2026-11-06',
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .patch(`/api/v1/food/log/${again.body.id}`)
      .set('Authorization', user.authorization)
      .send({ kcal: 70, saveAsMyProduct: true })
      .expect(200);
    const secondCopy = await prisma.foodProduct.findUniqueOrThrow({
      where: { id: second.body.productId },
    });
    expect(secondCopy.barcode).toBeNull();
  });

  it('saves two copies of one barcode at the same time', async () => {
    const user = await account('food-barcode-race@example.com');
    await subscribe(user.id);
    vi.mocked(off.barcode).mockResolvedValue({
      status: 'ok',
      value: {
        code: yogurtCode,
        product_name: 'Yogurt',
        nutriments: {
          'energy-kcal_100g': 60,
          proteins_100g: 4,
          fat_100g: 2,
          carbohydrates_100g: 5,
        },
      },
    });
    const found = await request(app.getHttpServer())
      .get(`/api/v1/food/products/search?barcode=${yogurtCode}`)
      .set('Authorization', user.authorization)
      .expect(200);
    const productId = found.body.products[0].id as string;
    const [firstLog, secondLog] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/food/log')
        .set('Authorization', user.authorization)
        .send({
          productId,
          grams: 100,
          meal: 'LUNCH',
          loggedOn: '2026-11-07',
        }),
      request(app.getHttpServer())
        .post('/api/v1/food/log')
        .set('Authorization', user.authorization)
        .send({
          productId,
          grams: 80,
          meal: 'DINNER',
          loggedOn: '2026-11-07',
        }),
    ]);
    expect(firstLog.status).toBe(201);
    expect(secondLog.status).toBe(201);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/food/log/${firstLog.body.id}`)
        .set('Authorization', user.authorization)
        .send({ kcal: 70, saveAsMyProduct: true }),
      request(app.getHttpServer())
        .patch(`/api/v1/food/log/${secondLog.body.id}`)
        .set('Authorization', user.authorization)
        .send({ kcal: 90, saveAsMyProduct: true }),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.kcal).toBe(70);
    expect(first.body.grams).toBe(100);
    expect(second.body.kcal).toBe(90);
    expect(second.body.grams).toBe(80);

    const copies = await prisma.foodProduct.findMany({
      where: { id: { in: [first.body.productId, second.body.productId] } },
    });
    expect(copies).toHaveLength(2);
    expect(copies.filter((copy) => copy.barcode === yogurtCode)).toHaveLength(
      1,
    );
    expect(copies.filter((copy) => copy.barcode === null)).toHaveLength(1);
  });

  it('falls back inside the same transaction when two copies insert one barcode', async () => {
    const user = await account('food-barcode-savepoint@example.com');
    const catalog = app.get(FoodCatalogRepository);
    const input = (name: string) => ({
      name,
      imageUrl: null,
      barcode: '4006381333931',
      basedOnProductId: null,
      kcalPer100g: new Prisma.Decimal(10),
      proteinPer100g: new Prisma.Decimal(1),
      fatPer100g: new Prisma.Decimal(1),
      carbsPer100g: new Prisma.Decimal(1),
    });
    const ids = await Promise.all([
      prisma.$transaction(async (tx) => {
        const copy = await catalog.copyFromEntry(user.id, input('A'), tx);
        await tx.foodProduct.update({
          where: { id: copy.id },
          data: { brand: 'kept' },
        });
        return copy.id;
      }),
      prisma.$transaction(async (tx) => {
        const copy = await catalog.copyFromEntry(user.id, input('B'), tx);
        await tx.foodProduct.update({
          where: { id: copy.id },
          data: { brand: 'kept' },
        });
        return copy.id;
      }),
    ]);
    const rows = await prisma.foodProduct.findMany({
      where: { id: { in: ids } },
    });
    expect(rows.every((row) => row.brand === 'kept')).toBe(true);
    expect(rows.filter((row) => row.barcode === '4006381333931')).toHaveLength(
      1,
    );
    expect(rows.filter((row) => row.barcode === null)).toHaveLength(1);
  });

  it('does not hide a unique violation that is not the barcode', async () => {
    const user = await account('food-barcode-other-unique@example.com');
    await prisma.foodProduct.create({
      data: {
        source: 'CUSTOM',
        ownerId: user.id,
        externalId: null,
        barcode: '4006381333931',
        name: 'Same name',
        kcalPer100g: 10,
        proteinPer100g: 1,
        fatPer100g: 1,
        carbsPer100g: 1,
      },
    });
    const catalog = app.get(FoodCatalogRepository);
    let caught: unknown;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          CREATE UNIQUE INDEX food_products_name_probe
          ON food_products (owner_id, name)
          WHERE source = 'CUSTOM'
        `;
        try {
          await catalog.copyFromEntry(
            user.id,
            {
              name: 'Same name',
              imageUrl: null,
              barcode: '0036000291452',
              basedOnProductId: null,
              kcalPer100g: new Prisma.Decimal(12),
              proteinPer100g: new Prisma.Decimal(1),
              fatPer100g: new Prisma.Decimal(1),
              carbsPer100g: new Prisma.Decimal(1),
            },
            tx,
          );
        } catch (error) {
          caught = error;
        }
        expect(
          await tx.foodProduct.count({
            where: { ownerId: user.id, name: 'Same name' },
          }),
        ).toBe(1);
        throw new Error('rollback name probe');
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== 'rollback name probe'
      ) {
        throw error;
      }
    }
    expect(caught).toMatchObject({ code: 'P2002' });
    expect(
      (caught as { meta?: { target?: unknown } }).meta?.target,
    ).not.toEqual(['owner_id', 'barcode']);
  });
});
