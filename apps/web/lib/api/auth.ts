import type { AuthResponse } from '@repo/shared-types';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@repo/validation';
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

export function forgotPassword(input: ForgotPasswordInput) {
  return apiRequest<void>('/auth/password/forgot', {
    method: 'POST',
    body: input,
    skipRefresh: true,
  });
}

export function resetPassword(input: ResetPasswordInput) {
  return apiRequest<void>('/auth/password/reset', {
    method: 'POST',
    body: input,
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
