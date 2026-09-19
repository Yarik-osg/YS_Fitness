'use client';

import type { OnboardingInput } from '@repo/validation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { writeSessionHint } from '@/lib/auth/session-cookie';
import { getMe, saveOnboarding } from '@/lib/api/users';
import { useAuthStore } from '@/lib/stores/auth-store';

export const meQueryKey = ['users', 'me'] as const;

export function useMe(enabled = true) {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: getMe,
    enabled,
  });
}

export function useSaveOnboarding() {
  return useMutation({
    mutationFn: (input: OnboardingInput) => saveOnboarding(input),
    onSuccess: (response) => {
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
    },
  });
}
