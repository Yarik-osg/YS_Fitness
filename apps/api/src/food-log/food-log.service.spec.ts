import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FoodLogEntry } from '@prisma/client';
import { normalizeBarcode } from '@repo/validation';
import { describe, expect, it, vi } from 'vitest';
import { FoodLogService } from './food-log.service.js';

const userId = 'user-1';
const entryId = 'entry-1';

function entry(overrides?: Partial<FoodLogEntry>): FoodLogEntry {
  return {
    id: entryId,
    userId,
    productId: 'off-product',
    loggedOn: new Date('2026-11-06T00:00:00.000Z'),
    meal: 'LUNCH',
    grams: new Prisma.Decimal(100),
    productName: 'Milk',
    imageUrl: null,
    kcal: new Prisma.Decimal(200),
    protein: new Prisma.Decimal(10),
    fat: new Prisma.Decimal(5),
    carbs: new Prisma.Decimal(20),
    createdAt: new Date('2026-11-06T08:00:00.000Z'),
    ...overrides,
  };
}

function harness(current = entry()) {
  const saved: FoodLogEntry[] = [];
  const db = { id: 'tx' };
  const entries = {
    lockOwned: vi.fn().mockResolvedValue(current),
    updateOwned: vi.fn(
      async (_userId: string, _id: string, data: Partial<FoodLogEntry>) => {
        const next = { ...current, ...data };
        saved.push(next);
        return next;
      },
    ),
    transaction: vi.fn(async (work: (client: typeof db) => Promise<unknown>) =>
      work(db),
    ),
    favoriteIdSet: vi.fn().mockResolvedValue(new Set()),
  };
  const catalog = {
    copyFromEntry: vi.fn().mockResolvedValue({ id: 'my-product' }),
    findVisible: vi.fn().mockResolvedValue({
      source: 'OFF',
      externalId: null,
      barcode: null,
    }),
    findCustomByBarcode: vi.fn().mockResolvedValue(null),
  };
  const service = new FoodLogService(
    entries as never,
    catalog as never,
    {} as never,
  );
  return { service, entries, catalog, saved, db };
}

describe('FoodLogService.update', () => {
  it('rescales the stored snapshot when only grams change', async () => {
    const { service, entries, catalog, saved, db } = harness();

    await service.update(userId, entryId, { grams: 50 });

    expect(catalog.copyFromEntry).not.toHaveBeenCalled();
    expect(entries.lockOwned).toHaveBeenCalledWith(userId, entryId, db);
    expect(saved[0]).toMatchObject({
      grams: new Prisma.Decimal(50),
      kcal: new Prisma.Decimal(100),
      protein: new Prisma.Decimal(5),
      fat: new Prisma.Decimal('2.5'),
      carbs: new Prisma.Decimal(10),
      productId: 'off-product',
    });
  });

  it('keeps a manual kcal and writes the personal product in the same transaction', async () => {
    const { service, entries, catalog, db } = harness();

    await service.update(userId, entryId, {
      grams: 50,
      kcal: 80,
      saveAsMyProduct: true,
    });

    expect(entries.transaction).toHaveBeenCalledOnce();
    expect(catalog.copyFromEntry).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        name: 'Milk',
        basedOnProductId: 'off-product',
        kcalPer100g: new Prisma.Decimal(160),
        proteinPer100g: new Prisma.Decimal(10),
      }),
      db,
    );
    expect(entries.updateOwned).toHaveBeenCalledWith(
      userId,
      entryId,
      expect.objectContaining({
        productId: 'my-product',
        kcal: new Prisma.Decimal(80),
        protein: new Prisma.Decimal(5),
      }),
      db,
    );
  });

  it('rejects a snapshot that is too large for the grams', async () => {
    const { service, catalog } = harness(
      entry({
        grams: new Prisma.Decimal('0.1'),
        kcal: new Prisma.Decimal('0.1'),
        protein: new Prisma.Decimal(0),
        fat: new Prisma.Decimal(0),
        carbs: new Prisma.Decimal(0),
      }),
    );

    await expect(
      service.update(userId, entryId, { kcal: 50, saveAsMyProduct: true }),
    ).rejects.toMatchObject({
      response: { code: 'FOOD_VALUES_OUT_OF_RANGE' },
    });
    expect(catalog.copyFromEntry).not.toHaveBeenCalled();
  });

  it('hides an entry that belongs to someone else', async () => {
    const { service, entries } = harness();
    entries.lockOwned.mockResolvedValue(null);

    await expect(
      service.update(userId, entryId, { grams: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(entries.updateOwned).not.toHaveBeenCalled();
  });

  it('copies an OFF barcode and leaves it blank when the user already owns it', async () => {
    const code = firstBarcode();
    const { service, catalog, db } = harness();
    catalog.findVisible.mockResolvedValue({
      source: 'OFF',
      externalId: code,
    });

    await service.update(userId, entryId, { saveAsMyProduct: true, grams: 50 });
    expect(catalog.copyFromEntry).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ barcode: code }),
      db,
    );

    catalog.findCustomByBarcode.mockResolvedValue({ id: 'owned' });
    await service.update(userId, entryId, { saveAsMyProduct: true, grams: 50 });
    expect(catalog.copyFromEntry).toHaveBeenLastCalledWith(
      userId,
      expect.objectContaining({ barcode: null }),
      db,
    );

    catalog.findVisible.mockResolvedValue({
      source: 'CUSTOM',
      externalId: null,
      barcode: code,
    });
    await service.update(userId, entryId, { saveAsMyProduct: true, grams: 50 });
    expect(catalog.copyFromEntry).toHaveBeenLastCalledWith(
      userId,
      expect.objectContaining({ barcode: null }),
      db,
    );
  });
});

function firstBarcode(): string {
  for (let value = 10 ** 12; value < 10 ** 12 + 200_000; value += 1) {
    const code = String(value);
    if (normalizeBarcode(code) === code) return code;
  }
  throw new Error('no barcode');
}

describe('FoodLogService.day', () => {
  it('marks logged products the user already favorited', async () => {
    const rows = [
      entry(),
      entry({ id: 'entry-2', productId: 'plain' }),
      entry({ id: 'entry-3', productId: null }),
    ];
    const entries = {
      listDay: vi.fn().mockResolvedValue(rows),
      favoriteIdSet: vi.fn().mockResolvedValue(new Set(['off-product'])),
    };
    const service = new FoodLogService(
      entries as never,
      {} as never,
      { getActiveTarget: vi.fn().mockResolvedValue(null) } as never,
    );

    const day = await service.day(userId, '2026-11-06');

    expect(entries.favoriteIdSet).toHaveBeenCalledWith(userId, [
      'off-product',
      'plain',
    ]);
    expect(day.entries.map((item) => item.isFavorite)).toEqual([
      true,
      false,
      false,
    ]);
  });
});
