import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth-store';
import { checkout, completeMockPayment, listPlans } from './subscriptions';

describe('subscriptions API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clearSession();
  });

  it('lists public catalog plans', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'plan-1', code: '1_MONTH' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listPlans();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/subscriptions/plans',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('posts checkout with the selected plan id', async () => {
    useAuthStore.getState().setAccessToken('access-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          subscription: { status: 'ACTIVE' },
          checkoutUrl: null,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await checkout('11111111-1111-4111-8111-111111111111');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/subscriptions/checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          planId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
  });

  it('posts the signed mock payment webhook', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ACTIVE' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await completeMockPayment({
      providerReference: 'pay_first',
      expiresAt: 1_800_000_000,
      signature: 'signed',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/subscriptions/webhooks/mock',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          providerReference: 'pay_first',
          expiresAt: 1_800_000_000,
          signature: 'signed',
        }),
      }),
    );
  });
});
