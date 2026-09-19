import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth-store';
import { saveOnboarding } from './users';

describe('saveOnboarding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clearSession();
  });

  it('calls the onboarding endpoint with the exact supplied payload', async () => {
    useAuthStore.getState().setAccessToken('access-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: { onboardingCompletedAt: '2026-09-19T10:00:00.000Z' },
          measurement: {},
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      dateOfBirth: '1994-05-10',
      biologicalSexForCalculation: 'FEMALE' as const,
      heightCm: 168,
      weightKg: 64.5,
      activityLevel: 'MODERATELY_ACTIVE' as const,
      goal: 'MAINTAIN_WEIGHT' as const,
      timezone: 'Europe/Kyiv',
    };

    await saveOnboarding(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/users/me/onboarding',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify(payload),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
  });
});
