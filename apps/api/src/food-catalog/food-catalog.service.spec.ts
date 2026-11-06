import { Prisma } from '@prisma/client';
import type { FoodProduct } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { FoodCatalogService } from './food-catalog.service.js';

const product = {
  id: 'product-1',
  source: 'OFF',
  externalId: '1111',
  ownerId: null,
  basedOnProductId: null,
  name: 'Cached milk',
  brand: null,
  imageUrl: null,
  kcalPer100g: new Prisma.Decimal(50),
  proteinPer100g: new Prisma.Decimal(1),
  fatPer100g: new Prisma.Decimal(1),
  carbsPer100g: new Prisma.Decimal(1),
  createdAt: new Date('2026-11-06T00:00:00.000Z'),
} satisfies FoodProduct;

function harness() {
  const products = {
    matchingCustom: vi.fn().mockResolvedValue([]),
    matchingOff: vi.fn().mockResolvedValue([product]),
    findSearch: vi.fn().mockResolvedValue({ fetchedAt: new Date() }),
    saveSearch: vi.fn(),
  };
  const off = { search: vi.fn(), barcode: vi.fn() };
  const service = new FoodCatalogService(products as never, off as never);
  return { service, products, off };
}

describe('FoodCatalogService.search cache', () => {
  it('serves a fresh query from the database without calling Open Food Facts', async () => {
    const { service, off } = harness();

    for (let i = 0; i < 20; i += 1) {
      const result = await service.search('user', { q: 'milk' });
      expect(result.fromCacheOnly).toBe(false);
      expect(result.products).toHaveLength(1);
    }
    expect(off.search).not.toHaveBeenCalled();
  });

  it('does not record a query when Open Food Facts fails', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockResolvedValue(null);
    off.search.mockRejectedValue(new Error('down'));

    await expect(service.search('user', { q: 'milk' })).rejects.toThrow('down');
    expect(products.saveSearch).not.toHaveBeenCalled();
  });
});
