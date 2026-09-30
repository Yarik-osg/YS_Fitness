import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth-store';
import { checkout, listPlans } from './subscriptions';

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
});
