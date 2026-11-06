import { BadGatewayException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OffOutboundLimiter } from './off-limiter.js';
import { OpenFoodFactsHttp, RateLimitedOffClient } from './off-client.js';

const config = {
  get(key: 'OFF_BASE_URL' | 'OFF_USER_AGENT') {
    return key === 'OFF_USER_AGENT'
      ? 'YSFitness/test'
      : 'https://world.openfoodfacts.org';
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
    expect(url).toContain('/cgi/search.pl');
    expect(url).toContain('search_terms=milk');
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
  it('does not call Open Food Facts when the search budget is spent', async () => {
    const http = {
      search: vi.fn(),
      barcode: vi.fn(),
    };
    const limiter = new OffOutboundLimiter();
    for (let i = 0; i < 10; i += 1) limiter.trySearch();
    const client = new RateLimitedOffClient(http as never, limiter);

    await expect(client.search('milk')).resolves.toEqual({ status: 'skipped' });
    expect(http.search).not.toHaveBeenCalled();
  });
});
