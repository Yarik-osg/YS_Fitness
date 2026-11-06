import { Prisma } from '@prisma/client';
import type { FoodProduct } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { FoodCatalogService } from './food-catalog.service.js';

interface NormalizedOff {
  externalId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  kcalPer100g: number;
}

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
    findOffByBarcode: vi.fn().mockResolvedValue(null),
    saveSearch: vi.fn(),
    upsertOff: vi.fn(async (normalized: NormalizedOff) =>
      stored(normalized.externalId, normalized.name, normalized.brand, {
        kcal: normalized.kcalPer100g,
        imageUrl: normalized.imageUrl,
      }),
    ),
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

  it('serves a stored barcode as a complete answer', async () => {
    const { service, products, off } = harness();
    products.findOffByBarcode.mockResolvedValue(product);

    const result = await service.search('user', { barcode: '1111' });

    expect(result.fromCacheOnly).toBe(false);
    expect(result.products).toEqual([
      expect.objectContaining({ externalId: '1111', name: 'Cached milk' }),
    ]);
    expect(off.barcode).not.toHaveBeenCalled();
  });

  it('returns saved foods when Open Food Facts fails and does not record the query', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockResolvedValue(null);
    off.search.mockRejectedValue(new Error('down'));

    const result = await service.search('user', { q: 'milk' });

    expect(result.fromCacheOnly).toBe(true);
    expect(result.products.map((item) => item.name)).toEqual(['Cached milk']);
    expect(products.saveSearch).not.toHaveBeenCalled();
  });

  it('still fails when Open Food Facts is down and nothing is saved', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockResolvedValue(null);
    products.matchingOff.mockResolvedValue([]);
    off.search.mockRejectedValue(new Error('down'));

    await expect(service.search('user', { q: 'milk' })).rejects.toThrow('down');
    expect(products.saveSearch).not.toHaveBeenCalled();
  });

  it('marks a spent allowance as a local answer', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockResolvedValue(null);
    off.search.mockResolvedValue({ status: 'skipped' });

    const result = await service.search('user', { q: 'milk' });

    expect(result.fromCacheOnly).toBe(true);
    expect(result.products.map((item) => item.name)).toEqual(['Cached milk']);
    expect(products.saveSearch).not.toHaveBeenCalled();
  });

  it('asks Open Food Facts once for Coca-Cola, Coca Cola, and кока кола', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockResolvedValue(null);
    products.matchingOff.mockResolvedValue([]);
    off.search.mockResolvedValue({ status: 'ok', value: [] });

    for (const q of ['Coca-Cola', 'Coca Cola', 'кока кола']) {
      await service.search('user', { q });
    }

    expect(off.search).toHaveBeenCalledTimes(3);
    expect(off.search).toHaveBeenNthCalledWith(1, 'user', 'coca cola');
    expect(off.search).toHaveBeenNthCalledWith(3, 'user', 'coca cola');
    expect(products.matchingOff).toHaveBeenCalledWith('coca cola');
    expect(products.saveSearch).toHaveBeenCalledWith(
      'coca cola',
      expect.any(Date),
    );
  });

  it('asks Open Food Facts for Snickers when the query is Снікерс', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockResolvedValue(null);
    off.search.mockResolvedValue({ status: 'ok', value: [] });

    await service.search('user', { q: 'Снікерс' });

    expect(off.search).toHaveBeenCalledWith('user', 'snickers');
    expect(products.matchingOff).toHaveBeenCalledWith('snickers');
  });

  it('does not call Open Food Facts again for a fresh alias of the same search', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockImplementation(async (key: string) =>
      key === 'snickers' ? { fetchedAt: new Date() } : null,
    );

    await service.search('user', { q: 'Снікерс' });

    expect(off.search).not.toHaveBeenCalled();
  });

  it('keeps Original and Zero, drops a row without kcal, and keeps a photo-less row', async () => {
    const { service, products, off } = harness();
    products.findSearch.mockResolvedValue(null);
    products.matchingOff.mockResolvedValue([]);
    products.matchingCustom.mockResolvedValue([
      stored('custom-coke', 'Coca-Cola', 'Home'),
    ]);
    off.search.mockResolvedValue({
      status: 'ok',
      value: [
        hit('111', 'Soft drink', ['Coca-Cola'], 40),
        hit('500', 'Coca-Cola Zero', ['Coca-Cola'], 0.3),
        hit('5449', 'Coca-Cola', ['Coca-Cola'], 42),
        hit('5449', 'Coca-Cola duplicate', ['Coca-Cola'], 42),
        hit('222', 'Coca-Cola Cherry', ['Coca-Cola'], 42, false),
        hit('333', 'Coca-Cola Mystery', ['Coca-Cola'], null),
      ],
    });

    const result = await service.search('user', { q: 'Coca-Cola' });
    const codes = result.products.map((item) => item.externalId);

    expect(result.fromCacheOnly).toBe(false);
    expect(codes).toEqual([null, '5449', '500', '222', '111']);
    expect(result.products.map((item) => item.name)).toEqual([
      'Coca-Cola',
      'Coca-Cola',
      'Coca-Cola Zero',
      'Coca-Cola Cherry',
      'Soft drink',
    ]);
    expect(result.products[3]?.imageUrl).toBeNull();
    expect(codes).not.toContain('333');
    expect(products.upsertOff).toHaveBeenCalledTimes(4);
  });
});

function hit(
  code: string,
  name: string,
  brands: string[],
  kcal: number | null,
  photo = true,
) {
  return {
    code,
    product_name: name,
    brands,
    image_front_small_url: photo ? 'https://images.example/can.jpg' : undefined,
    nutriments:
      kcal === null
        ? { proteins_100g: 1 }
        : {
            'energy-kcal_100g': kcal,
            proteins_100g: 0,
            fat_100g: 0,
            carbohydrates_100g: 10,
          },
  };
}

function stored(
  id: string,
  name: string,
  brand: string | null,
  extra?: { kcal?: number; imageUrl?: string | null },
): FoodProduct {
  return {
    id,
    source: id.startsWith('custom') ? 'CUSTOM' : 'OFF',
    externalId: id.startsWith('custom') ? null : id,
    ownerId: id.startsWith('custom') ? 'user' : null,
    basedOnProductId: null,
    name,
    brand,
    imageUrl: extra?.imageUrl ?? null,
    kcalPer100g: new Prisma.Decimal(extra?.kcal ?? 42),
    proteinPer100g: new Prisma.Decimal(0),
    fatPer100g: new Prisma.Decimal(0),
    carbsPer100g: new Prisma.Decimal(10),
    createdAt: new Date('2026-11-06T00:00:00.000Z'),
  };
}
