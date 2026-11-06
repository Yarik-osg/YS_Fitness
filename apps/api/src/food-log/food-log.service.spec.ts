import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FoodLogEntry } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { FoodLogService } from './food-log.service.js';

const userId = 'user-1';
const entryId = 'entry-1';

function entry(): FoodLogEntry {
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
  };
}

function harness() {
  const current = entry();
  const saved: FoodLogEntry[] = [];
  const entries = {
    findOwned: vi.fn().mockResolvedValue(current),
    updateOwned: vi.fn(
      async (_userId: string, _id: string, data: Partial<FoodLogEntry>) => {
        const next = { ...current, ...data };
        saved.push(next);
        return next;
      },
    ),
    transaction: vi.fn(async (work: (db: { id: string }) => Promise<unknown>) =>
      work({ id: 'tx' }),
    ),
  };
  const catalog = {
    copyFromEntry: vi.fn().mockResolvedValue({ id: 'my-product' }),
  };
  const service = new FoodLogService(
    entries as never,
    catalog as never,
    {} as never,
  );
  return { service, entries, catalog, saved };
}

describe('FoodLogService.update', () => {
  it('rescales the stored snapshot when only grams change', async () => {
    const { service, entries, catalog, saved } = harness();

    await service.update(userId, entryId, { grams: 50 });

    expect(catalog.copyFromEntry).not.toHaveBeenCalled();
    expect(entries.transaction).not.toHaveBeenCalled();
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
    const { service, entries, catalog } = harness();

    await service.update(userId, entryId, {
      grams: 50,
      kcal: 80,
      saveAsMyProduct: true,
    });

    const db = { id: 'tx' };
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

  it('hides an entry that belongs to someone else', async () => {
    const { service, entries } = harness();
    entries.findOwned.mockResolvedValue(null);

    await expect(
      service.update(userId, entryId, { grams: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(entries.updateOwned).not.toHaveBeenCalled();
  });
});
