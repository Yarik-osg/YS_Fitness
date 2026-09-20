'use client';

import type { AuthResponse } from '@repo/shared-types';
import type { LoginInput, RegisterInput } from '@repo/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bindOnboardingDraftToUser,
  resetOnboardingDraft,
} from '@/features/onboarding/onboarding-store';
import * as authApi from '@/lib/api/auth';
import { getMe } from '@/lib/api/users';
import { getPostAuthPath } from '@/lib/auth/routing';
import { clearSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { normalizeSessionUser, useAuthStore } from '@/lib/stores/auth-store';

async function hydrateAuthenticatedUser(
  response: AuthResponse,
  options: { replaceOnboardingDraft?: boolean } = {},
) {
  useAuthStore.getState().setAccessToken(response.tokens.accessToken);
  const user = await getMe();
  useAuthStore
    .getState()
    .setSession(response.tokens.accessToken, normalizeSessionUser(user));
  writeSessionHint(
    user.profile?.onboardingCompletedAt ? 'complete' : 'onboarding',
  );
  syncOnboardingDraft(user, options.replaceOnboardingDraft);
  return { user, destination: getPostAuthPath(user) };
}

function syncOnboardingDraft(
  user: Awaited<ReturnType<typeof getMe>>,
  replace = false,
) {
  if (user.profile?.onboardingCompletedAt) {
    resetOnboardingDraft();
    return;
  }
  bindOnboardingDraftToUser(user.id, { replace });
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
      hydrateAuthenticatedUser(await authApi.register(input), {
        replaceOnboardingDraft: true,
      }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      useAuthStore.getState().clearSession();
      clearSessionHint();
      resetOnboardingDraft();
      queryClient.clear();
    },
  });
}
