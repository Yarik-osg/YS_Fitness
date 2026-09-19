'use client';

import type { AuthResponse } from '@repo/shared-types';
import type { LoginInput, RegisterInput } from '@repo/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { getPostAuthPath } from '@/lib/auth/routing';
import * as authApi from '@/lib/api/auth';
import { getMe } from '@/lib/api/users';
import { normalizeSessionUser, useAuthStore } from '@/lib/stores/auth-store';

async function hydrateAuthenticatedUser(response: AuthResponse) {
  useAuthStore.getState().setAccessToken(response.tokens.accessToken);
  const user = await getMe();
  useAuthStore
    .getState()
    .setSession(response.tokens.accessToken, normalizeSessionUser(user));
  writeSessionHint(
    user.profile?.onboardingCompletedAt ? 'complete' : 'onboarding',
  );
  return { user, destination: getPostAuthPath(user) };
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: Omit<LoginInput, 'clientType'>) =>
      hydrateAuthenticatedUser(await authApi.login(input)),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: Omit<RegisterInput, 'clientType'>) =>
      hydrateAuthenticatedUser(await authApi.register(input)),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      useAuthStore.getState().clearSession();
      clearSessionHint();
      queryClient.clear();
    },
  });
}
