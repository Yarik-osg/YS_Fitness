import type { ApiError, AuthResponse } from '@repo/shared-types';
import { clearSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { useAuthStore } from '@/lib/stores/auth-store';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
const CSRF_COOKIE_NAME = `${
  process.env.NEXT_PUBLIC_REFRESH_COOKIE_NAME ?? 'ys_refresh'
}_csrf`;

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  accessToken?: string | null;
  skipRefresh?: boolean;
}

let refreshPromise: Promise<AuthResponse> | null = null;

function readCookie(name: string) {
  if (typeof document === 'undefined') return undefined;

  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function parseError(response: Response): Promise<ApiClientError> {
  let error: Partial<ApiError> = {};

  try {
    error = (await response.json()) as ApiError;
  } catch {
    // The fallback below covers empty and non-JSON error responses.
  }

  return new ApiClientError(
    response.status,
    error.code ?? 'HTTP_ERROR',
    error.message ?? 'The request could not be completed.',
    error.details,
  );
}

async function performRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, accessToken, skipRefresh, headers, ...requestInit } = options;
  const csrfToken = readCookie(CSRF_COOKIE_NAME);
  const requestHeaders = new Headers(headers);

  if (body !== undefined)
    requestHeaders.set('content-type', 'application/json');
  if (accessToken) requestHeaders.set('authorization', `Bearer ${accessToken}`);
  if (csrfToken)
    requestHeaders.set('x-csrf-token', decodeURIComponent(csrfToken));

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      headers: requestHeaders,
    });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the service. Check your connection and try again.',
    );
  }

  if (
    response.status === 401 &&
    !skipRefresh &&
    path !== '/auth/refresh' &&
    typeof window !== 'undefined'
  ) {
    const refreshed = await refreshSession();
    return performRequest<T>(path, {
      ...options,
      accessToken: refreshed.tokens.accessToken,
      skipRefresh: true,
    });
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return null as T;

  return JSON.parse(text) as T;
}

export function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const token = options.accessToken ?? useAuthStore.getState().accessToken;
  return performRequest<T>(path, { ...options, accessToken: token });
}

export function refreshSession(): Promise<AuthResponse> {
  if (!refreshPromise) {
    refreshPromise = performRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { clientType: 'WEB' },
      skipRefresh: true,
    })
      .then((response) => {
        useAuthStore.getState().setSession(response.tokens.accessToken, {
          ...response.user,
          onboardingCompletedAt: response.user.onboardingCompletedAt,
        });
        writeSessionHint(
          response.user.onboardingCompletedAt ? 'complete' : 'onboarding',
        );
        return response;
      })
      .catch((error: unknown) => {
        useAuthStore.getState().clearSession();
        clearSessionHint();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}
