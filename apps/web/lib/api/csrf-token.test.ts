import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '@/lib/auth/csrf-token';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiRequest } from './client';
import { login } from './auth';

describe('cross-site CSRF token', () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
    useAuthStore.getState().clearSession();
  });

  it('stores the login token on this host and sends it later', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'user-1' },
            tokens: { accessToken: 'access-token', expiresIn: 900 },
            csrfToken: 'nonce.signature',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response('null', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await login({ email: 'alina@example.com', password: 'strong-password' });
    expect(document.cookie).toContain('ys_csrf=nonce.signature');

    useAuthStore.getState().setAccessToken('access-token');
    await apiRequest('/users/me');

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(request.headers).get('x-csrf-token')).toBe(
      'nonce.signature',
    );
  });
});
