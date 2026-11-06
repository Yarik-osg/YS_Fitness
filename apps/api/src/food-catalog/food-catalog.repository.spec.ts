import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { FoodCatalogRepository } from './food-catalog.repository.js';

describe('FoodCatalogRepository.copyFromEntry', () => {
  it('inserts a custom copy and leaves the original product alone', async () => {
    const db = {
      foodProduct: {
        create: vi.fn().mockResolvedValue({ id: 'copy' }),
        update: vi.fn(),
      },
    };
    const repository = new FoodCatalogRepository({} as never);

    await repository.copyFromEntry(
      'user-1',
      {
        name: 'Milk',
        imageUrl: null,
        basedOnProductId: 'off-product',
        kcalPer100g: new Prisma.Decimal(160),
        proteinPer100g: new Prisma.Decimal(10),
        fatPer100g: new Prisma.Decimal(5),
        carbsPer100g: new Prisma.Decimal(20),
      },
      db as never,
    );

    expect(db.foodProduct.update).not.toHaveBeenCalled();
    expect(db.foodProduct.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'CUSTOM',
        ownerId: 'user-1',
        basedOnProductId: 'off-product',
        externalId: null,
      }),
      select: { id: true },
    });
  });
});
