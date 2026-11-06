import { BadGatewayException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OffOutboundLimiter, SystemClock } from './off-limiter.js';
import { OpenFoodFactsHttp, RateLimitedOffClient } from './off-client.js';

const config = {
  get(key: 'OFF_BASE_URL' | 'OFF_SEARCH_URL' | 'OFF_USER_AGENT') {
    if (key === 'OFF_USER_AGENT') return 'YSFitness/test';
    if (key === 'OFF_SEARCH_URL') return 'https://search.openfoodfacts.org';
    return 'https://world.openfoodfacts.org';
  },
};

describe('OpenFoodFactsHttp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the configured user agent and hides an upstream failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error('secret upstream body'));
    vi.stubGlobal('fetch', fetchMock);
    const client = new OpenFoodFactsHttp(config as never);

    await expect(client.search('milk')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    await expect(client.search('milk')).rejects.toMatchObject({
      response: {
        code: 'OFF_UNAVAILABLE',
        message: 'Food search is unavailable',
      },
    });
    expect(JSON.stringify(fetchMock.mock.calls)).toContain('YSFitness/test');
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      'secret upstream body',
    );
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toBe(
      'https://search.openfoodfacts.org/search?q=milk&page_size=20',
    );
  });

  it('reads hits and ignores a legacy products array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [{ code: '5449000000996' }],
        products: [{ code: 'ignored' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new OpenFoodFactsHttp(config as never);

    await expect(client.search('coca cola')).resolves.toEqual([
      { code: '5449000000996' },
    ]);
  });

  it('treats a missing barcode as empty and a non-ok response as unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 0 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    const client = new OpenFoodFactsHttp(config as never);

    await expect(client.barcode('4820')).resolves.toBeNull();
    await expect(client.barcode('4820')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('RateLimitedOffClient', () => {
  it('does not call Open Food Facts when the user allowance is spent', async () => {
    const http = { search: vi.fn(), barcode: vi.fn() };
    const limiter = new OffOutboundLimiter(new SystemClock(), {
      searchPerMin: 10,
      userPerMin: 3,
      barcodePerMin: 100,
    });
    const client = new RateLimitedOffClient(http as never, limiter);
    http.search.mockResolvedValue([]);

    await client.search('user', 'one');
    await client.search('user', 'two');
    await client.search('user', 'three');
    await expect(client.search('user', 'four')).resolves.toEqual({
      status: 'skipped',
    });
    expect(http.search).toHaveBeenCalledTimes(3);
    limiter.onModuleDestroy();
  });

  it('keeps the spent allowance when Open Food Facts fails', async () => {
    const http = {
      search: vi.fn().mockRejectedValue(new Error('down')),
      barcode: vi.fn(),
    };
    const limiter = new OffOutboundLimiter(new SystemClock(), {
      searchPerMin: 10,
      userPerMin: 1,
      barcodePerMin: 100,
    });
    const client = new RateLimitedOffClient(http as never, limiter);

    await expect(client.search('user', 'milk')).rejects.toThrow('down');
    await expect(client.search('user', 'milk')).resolves.toEqual({
      status: 'skipped',
    });
    expect(http.search).toHaveBeenCalledTimes(1);
    limiter.onModuleDestroy();
  });
});
