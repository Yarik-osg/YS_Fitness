import type { ApiError, AuthResponse } from '@repo/shared-types';
import { publicApiBaseUrl } from '@/lib/env';
import {
  clearCsrfToken,
  readCsrfToken,
  writeCsrfToken,
} from '@/lib/auth/csrf-token';
import { clearSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { useAuthStore } from '@/lib/stores/auth-store';

const AUTH_PATHS = new Set(['/auth/login', '/auth/register', '/auth/refresh']);

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

function rememberCsrfToken(path: string, body: unknown) {
  if (!AUTH_PATHS.has(path) || !body || typeof body !== 'object') return;
  const token = (body as { csrfToken?: unknown }).csrfToken;
  if (typeof token === 'string' && token) writeCsrfToken(token);
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
  const csrfToken = readCsrfToken();
  const requestHeaders = new Headers(headers);

  if (body !== undefined)
    requestHeaders.set('content-type', 'application/json');
  if (accessToken) requestHeaders.set('authorization', `Bearer ${accessToken}`);
  if (csrfToken) requestHeaders.set('x-csrf-token', csrfToken);

  let response: Response;

  try {
    response = await fetch(`${publicApiBaseUrl}${path}`, {
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

  const parsed = JSON.parse(text) as T;
  rememberCsrfToken(path, parsed);
  return parsed;
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
        clearCsrfToken();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}
