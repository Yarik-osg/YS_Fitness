'use client';

import type { OnboardingInput, ProfileUpdateInput } from '@repo/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { writeSessionHint } from '@/lib/auth/session-cookie';
import {
  getMe,
  getOnboardingResponses,
  saveOnboarding,
  updateProfile,
} from '@/lib/api/users';
import {
  myProgramQueryKey,
  assignedProgramQueryKey,
} from '@/lib/hooks/use-programs';
import { useAuthStore } from '@/lib/stores/auth-store';

export const meQueryKey = ['users', 'me'] as const;
export const onboardingResponsesQueryKey = [
  'users',
  'me',
  'onboarding-responses',
] as const;

export function useMe(enabled = true) {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: getMe,
    enabled,
  });
}

export function useOnboardingResponses(enabled = true) {
  return useQuery({
    queryKey: onboardingResponsesQueryKey,
    queryFn: getOnboardingResponses,
    enabled,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => updateProfile(input),
    onSuccess: (response) => {
      queryClient.setQueryData(assignedProgramQueryKey, response.program);
      void queryClient.invalidateQueries({ queryKey: myProgramQueryKey });
      queryClient.setQueryData(
        meQueryKey,
        (current: Awaited<ReturnType<typeof getMe>> | undefined) => {
          if (!current?.profile) return current;
          const measurements = current.bodyMeasurements.slice();
          if (measurements[0]) {
            measurements[0] = {
              ...measurements[0],
              weightKg: String(response.weightKg),
            };
          } else {
            measurements.unshift({
              id: 'local-weight',
              weightKg: String(response.weightKg),
              bodyFatPercent: null,
              measuredAt: new Date().toISOString(),
            });
          }
          return {
            ...current,
            profile: { ...current.profile, heightCm: response.heightCm },
            bodyMeasurements: measurements,
          };
        },
      );
      if (
        !response.experience ||
        !response.mainGoal ||
        !response.trainingFrequency
      ) {
        return;
      }
      const current = queryClient.getQueryData<
        Awaited<ReturnType<typeof getOnboardingResponses>>
      >(onboardingResponsesQueryKey);
      if (current?.responses) {
        queryClient.setQueryData(onboardingResponsesQueryKey, {
          responses: {
            ...current.responses,
            experience: response.experience,
            mainGoal: response.mainGoal,
            trainingFrequency: response.trainingFrequency,
          },
        });
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: onboardingResponsesQueryKey,
      });
    },
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
            name: response.profile.name,
            onboardingCompletedAt: response.profile.onboardingCompletedAt,
          },
        });
      }
      writeSessionHint('complete');
    },
  });
}
