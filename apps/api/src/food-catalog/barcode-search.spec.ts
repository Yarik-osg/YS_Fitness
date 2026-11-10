import { Prisma } from '@prisma/client';
import { normalizeBarcode } from '@repo/validation';
import { describe, expect, it, vi } from 'vitest';
import { FoodCatalogService, barcodeCacheKey } from './food-catalog.service.js';
import { OpenFoodFactsHttp, RateLimitedOffClient } from './off-client.js';
import { OffOutboundLimiter, SystemClock } from './off-limiter.js';

function firstValid(length: 8 | 12 | 13): string {
  const start = 10 ** (length - 1);
  for (let value = start; value < start + 200_000; value += 1) {
    const code = String(value);
    if (normalizeBarcode(code)) return code;
  }
  throw new Error(`no valid ${length}-digit barcode`);
}

const ean = firstValid(13);
const upc = firstValid(12);
const widened = normalizeBarcode(upc) ?? '';

function row(externalId: string, name = 'Cached') {
  return {
    id: externalId,
    source: 'OFF' as const,
    externalId,
    barcode: externalId,
    name,
    brand: null,
    imageUrl: null,
    kcalPer100g: new Prisma.Decimal(50),
    proteinPer100g: new Prisma.Decimal(1),
    fatPer100g: new Prisma.Decimal(1),
    carbsPer100g: new Prisma.Decimal(1),
  };
}

function harness() {
  const products = {
    findCustomByBarcode: vi.fn().mockResolvedValue(null),
    findOffByExternalIds: vi.fn().mockResolvedValue(null),
    findSearch: vi.fn().mockResolvedValue(null),
    saveSearch: vi.fn(),
    upsertOff: vi.fn(async (product: { externalId: string; name: string }) =>
      row(product.externalId, product.name),
    ),
  };
  const off = {
    barcode: vi.fn().mockResolvedValue({ status: 'ok', value: null }),
  };
  const service = new FoodCatalogService(products as never, off as never);
  return { service, products, off };
}

describe('barcode search', () => {
  it('returns the caller’s custom food before the Open Food Facts cache', async () => {
    const { service, products, off } = harness();
    products.findCustomByBarcode.mockResolvedValue({
      ...row(ean, 'Mine'),
      source: 'CUSTOM',
      externalId: null,
      barcode: ean,
    });
    products.findOffByExternalIds.mockResolvedValue(row(ean, 'Theirs'));

    const result = await service.search('user-a', { barcode: ean });

    expect(products.findCustomByBarcode).toHaveBeenCalledWith('user-a', ean);
    expect(result.products.map((item) => item.name)).toEqual(['Mine']);
    expect(result.fromCacheOnly).toBe(false);
    expect(off.barcode).not.toHaveBeenCalled();
  });

  it('does not ask another user for a custom barcode', async () => {
    const { service, products } = harness();
    await service.search('user-b', { barcode: ean });
    expect(products.findCustomByBarcode).toHaveBeenCalledWith('user-b', ean);
  });

  it('uses a stored Open Food Facts row without an outbound call', async () => {
    const { service, products, off } = harness();
    products.findOffByExternalIds.mockResolvedValue(row(ean, 'Shelf'));

    const result = await service.search('user-a', {
      barcode: ean,
      q: 'ignored',
    });

    expect(result.products[0]?.name).toBe('Shelf');
    expect(off.barcode).not.toHaveBeenCalled();
  });

  it('still finds a legacy 12-digit stored code from its EAN-13 form', async () => {
    const { service, products, off } = harness();
    products.findOffByExternalIds.mockImplementation(async (ids: string[]) => {
      expect(ids).toEqual([widened, upc]);
      return row(upc, 'Legacy');
    });

    const result = await service.search('user-a', { barcode: widened });

    expect(result.products[0]?.externalId).toBe(upc);
    expect(off.barcode).not.toHaveBeenCalled();
  });

  it('records one definitive miss and skips Open Food Facts until the day is over', async () => {
    const { service, products, off } = harness();
    const first = await service.search('user-a', { barcode: ean });
    expect(first.products).toEqual([]);
    expect(first.fromCacheOnly).toBe(false);
    expect(products.saveSearch).toHaveBeenCalledTimes(1);
    expect(products.saveSearch).toHaveBeenCalledWith(
      barcodeCacheKey(ean),
      expect.any(Date),
    );

    products.findSearch.mockResolvedValue({ fetchedAt: new Date() });
    const second = await service.search('user-a', { barcode: ean });
    expect(second.products).toEqual([]);
    expect(second.fromCacheOnly).toBe(false);
    expect(off.barcode).toHaveBeenCalledTimes(1);
  });

  it('treats a product without kcal or over the cap as a cached miss', async () => {
    const { service, products, off } = harness();
    off.barcode.mockResolvedValueOnce({
      status: 'ok',
      value: { code: ean, product_name: 'Bare', nutriments: {} },
    });
    await service.search('user-a', { barcode: ean });
    off.barcode.mockResolvedValueOnce({
      status: 'ok',
      value: {
        code: ean,
        product_name: 'Huge',
        nutriments: { 'energy-kcal_100g': 1e7 },
      },
    });
    products.findSearch.mockResolvedValue(null);
    await service.search('user-a', { barcode: ean });
    expect(products.saveSearch).toHaveBeenCalledTimes(2);
    expect(products.upsertOff).not.toHaveBeenCalled();
  });

  it('returns local results when Open Food Facts fails and does not record the miss', async () => {
    const { service, products, off } = harness();
    off.barcode.mockRejectedValue(new Error('down'));

    const result = await service.search('user-a', { barcode: ean });

    expect(result).toEqual({ products: [], fromCacheOnly: true });
    expect(products.saveSearch).not.toHaveBeenCalled();
  });

  it('does not call Open Food Facts when the user allowance is spent', async () => {
    const { service, off } = harness();
    off.barcode.mockResolvedValue({ status: 'skipped' });

    const result = await service.search('user-a', { barcode: ean });

    expect(result.fromCacheOnly).toBe(true);
    expect(off.barcode).toHaveBeenCalledWith('user-a', ean);
  });

  it('records an Open Food Facts 404 as a miss and does not spend the next allowance', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: 0, status_verbose: 'product not found' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const http = new OpenFoodFactsHttp({
      get(key: string) {
        if (key === 'OFF_USER_AGENT') return 'YSFitness/test';
        return 'https://world.openfoodfacts.org';
      },
    } as never);
    const limiter = new OffOutboundLimiter(new SystemClock(), {
      searchPerMin: 10,
      userPerMin: 3,
      barcodePerMin: 100,
      barcodeUserPerMin: 2,
    });
    const remembered = new Set<string>();
    const products = {
      findCustomByBarcode: vi.fn().mockResolvedValue(null),
      findOffByExternalIds: vi.fn().mockResolvedValue(null),
      findSearch: vi.fn(async (key: string) =>
        remembered.has(key) ? { fetchedAt: new Date() } : null,
      ),
      saveSearch: vi.fn(async (key: string) => {
        remembered.add(key);
      }),
      upsertOff: vi.fn(),
    };
    const service = new FoodCatalogService(
      products as never,
      new RateLimitedOffClient(http, limiter),
    );
    const code = '4006381333931';
    try {
      const first = await service.search('user-a', { barcode: code });
      expect(first).toEqual({ products: [], fromCacheOnly: false });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(products.saveSearch).toHaveBeenCalledWith(
        barcodeCacheKey(code),
        expect.any(Date),
      );

      const second = await service.search('user-a', { barcode: code });
      expect(second).toEqual({ products: [], fromCacheOnly: false });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const other = await service.search('user-a', {
        barcode: '0036000291452',
      });
      expect(other.fromCacheOnly).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      limiter.onModuleDestroy();
      vi.unstubAllGlobals();
    }
  });
});
