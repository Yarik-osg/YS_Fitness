import type { AuthResponse } from '@repo/shared-types';
import type { LoginInput, RegisterInput } from '@repo/validation';
import { apiRequest, refreshSession } from './client';

export function register(input: Omit<RegisterInput, 'clientType'>) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { ...input, clientType: 'WEB' },
    skipRefresh: true,
  });
}

export function login(input: Omit<LoginInput, 'clientType'>) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { ...input, clientType: 'WEB' },
    skipRefresh: true,
  });
}

export function refresh() {
  return refreshSession();
}

export function logout() {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { clientType: 'WEB' },
    skipRefresh: true,
  });
}
