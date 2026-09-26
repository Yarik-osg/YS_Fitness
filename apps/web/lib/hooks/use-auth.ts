'use client';

import type { AuthResponse, MeResponse } from '@repo/shared-types';
import type { LoginInput, RegisterInput } from '@repo/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bindOnboardingDraftToUser,
  reportOnboardingSubmitError,
  resetOnboardingDraft,
  useOnboardingStore,
} from '@/features/onboarding/onboarding-store';
import { validateOnboardingDraft } from '@/features/onboarding/payload';
import { ONBOARDING_WIZARD_STEPS } from '@/features/onboarding/program-track';
import * as authApi from '@/lib/api/auth';
import { ApiClientError } from '@/lib/api/client';
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

export type GuestOnboardingResult =
  | { kind: 'saved'; user: MeResponse }
  | { kind: 'empty' }
  | { kind: 'invalid'; step: number }
  | { kind: 'failed'; step: number; error: unknown };

const PROFILE_STEP = ONBOARDING_WIZARD_STEPS - 1;

export async function persistGuestOnboardingIfReady(): Promise<GuestOnboardingResult> {
  const draft = useOnboardingStore.getState();
  if (!draft.programTrack) return { kind: 'empty' };
  persistProgramTrack(draft.programTrack);

  const validation = validateOnboardingDraft(draft);
  if (!validation.ok) {
    reportOnboardingSubmitError(validation.step, {
      code: 'ONBOARDING_INCOMPLETE',
    });
    return { kind: 'invalid', step: validation.step };
  }

  let response: Awaited<ReturnType<typeof saveOnboarding>>;
  try {
    response = await saveOnboarding(validation.payload);
  } catch (error) {
    reportOnboardingSubmitError(PROFILE_STEP, submitErrorFrom(error));
    return { kind: 'failed', step: PROFILE_STEP, error };
  }

  const currentUser = useAuthStore.getState().user;
  if (currentUser) {
    useAuthStore.setState({
      user: {
        ...currentUser,
        name: response.profile.name,
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
  return { kind: 'saved', user };
}

function submitErrorFrom(error: unknown) {
  return error instanceof ApiClientError
    ? { code: error.code, status: error.status, message: error.message }
    : { code: 'ONBOARDING_SAVE_FAILED' };
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
      if (result.user.profile?.onboardingCompletedAt) {
        return { user: result.user, destination: getPostRegisterPath() };
      }
      const saved = await persistGuestOnboardingIfReady();
      if (saved.kind === 'saved') {
        return { user: saved.user, destination: getPostRegisterPath() };
      }
      return { user: result.user, destination: '/onboarding' };
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
