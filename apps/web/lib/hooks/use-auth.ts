'use client';

import type { AuthResponse } from '@repo/shared-types';
import type { LoginInput, RegisterInput } from '@repo/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bindOnboardingDraftToUser,
  resetOnboardingDraft,
  useOnboardingStore,
} from '@/features/onboarding/onboarding-store';
import { tryBuildOnboardingPayload } from '@/features/onboarding/payload';
import * as authApi from '@/lib/api/auth';
import { getMe, saveOnboarding } from '@/lib/api/users';
import { getPostAuthPath, getPostRegisterPath } from '@/lib/auth/routing';
import { clearSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { normalizeSessionUser, useAuthStore } from '@/lib/stores/auth-store';
import { persistProgramTrack } from '@/lib/subscriptions/selected-plan';

async function hydrateAuthenticatedUser(
  response: AuthResponse,
  options: { replace?: boolean; claimGuest?: boolean } = {},
) {
  useAuthStore.getState().setAccessToken(response.tokens.accessToken);
  const user = await getMe();
  useAuthStore
    .getState()
    .setSession(response.tokens.accessToken, normalizeSessionUser(user));
  writeSessionHint(
    user.profile?.onboardingCompletedAt ? 'complete' : 'onboarding',
  );
  syncOnboardingDraft(user, options);
  return { user, destination: getPostAuthPath(user) };
}

function syncOnboardingDraft(
  user: Awaited<ReturnType<typeof getMe>>,
  options: { replace?: boolean; claimGuest?: boolean } = {},
) {
  if (user.profile?.onboardingCompletedAt) {
    resetOnboardingDraft();
    return;
  }
  bindOnboardingDraftToUser(user.id, options);
}

export async function persistGuestOnboardingIfReady() {
  const draft = useOnboardingStore.getState();
  if (draft.programTrack) {
    persistProgramTrack(draft.programTrack);
  }
  const payload = tryBuildOnboardingPayload(draft);
  if (!payload) return null;

  const response = await saveOnboarding(payload);
  const currentUser = useAuthStore.getState().user;
  if (currentUser) {
    useAuthStore.setState({
      user: {
        ...currentUser,
        onboardingCompletedAt: response.profile.onboardingCompletedAt,
      },
    });
  }
  writeSessionHint('complete');
  resetOnboardingDraft();
  const user = await getMe();
  useAuthStore
    .getState()
    .setSession(
      useAuthStore.getState().accessToken ?? '',
      normalizeSessionUser(user),
    );
  return user;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: Omit<LoginInput, 'clientType'>) =>
      hydrateAuthenticatedUser(await authApi.login(input)),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: Omit<RegisterInput, 'clientType'>) => {
      const result = await hydrateAuthenticatedUser(
        await authApi.register(input),
        { claimGuest: true },
      );
      if (!result.user.profile?.onboardingCompletedAt) {
        try {
          const user = await persistGuestOnboardingIfReady();
          if (user) {
            return { user, destination: getPostRegisterPath() };
          }
        } catch {
          // The quiz stays local; checkout can save it after the account exists.
        }
      }
      return { user: result.user, destination: getPostRegisterPath() };
    },
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
