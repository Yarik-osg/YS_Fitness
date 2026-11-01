'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/client';
import { grantSubscription } from '@/lib/api/subscriptions';
import {
  archiveCoachClient,
  listProgramClients,
  restoreCoachClient,
  applyNutritionCalculation,
  assignCoachProgram,
  getCoachClient,
  getCoachNutrition,
  listCoachNutritionRoster,
  setManualNutritionTarget,
  updateCoachNote,
  listCoachClients,
  listCoachMeasurements,
  listCoachProgressPhotos,
  listCoachStrength,
  listCoachWorkouts,
} from '@/lib/api/coach';

export const COACH_WORKOUT_PAGE = 20;

export function useCoachClients() {
  return useQuery({
    queryKey: ['coach', 'clients'],
    queryFn: listCoachClients,
  });
}

export function useCoachNutritionRoster() {
  return useQuery({
    queryKey: ['coach', 'nutrition'],
    queryFn: listCoachNutritionRoster,
  });
}

export function isArchiveRefreshKey(
  key: readonly unknown[],
  userId: string,
): boolean {
  if (key[0] !== 'coach' || key[1] !== 'clients') return false;
  if (key.length === 2) return true;
  return key.length === 3 && key[2] === userId;
}

export function useArchiveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => archiveCoachClient(userId),
    onSuccess: async (_result, userId) => {
      await queryClient.invalidateQueries({
        predicate: (query) => refreshesClientLists(query.queryKey, userId),
      });
    },
  });
}

export function useRestoreClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => restoreCoachClient(userId),
    onSuccess: async (_result, userId) => {
      await queryClient.invalidateQueries({
        predicate: (query) => refreshesClientLists(query.queryKey, userId),
      });
    },
  });
}

export function useProgramClients(templateId: string) {
  return useQuery({
    queryKey: ['coach', 'program-clients', templateId],
    queryFn: () => listProgramClients(templateId),
    retry: (failureCount, error) =>
      !(error instanceof ApiClientError && error.status === 404) &&
      failureCount < 2,
  });
}

function refreshesClientLists(key: readonly unknown[], userId: string) {
  return (
    isArchiveRefreshKey(key, userId) ||
    (key[0] === 'coach' && key[1] === 'program-clients')
  );
}

export function useUpdateCoachNote(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { note: string; base: string }) =>
      updateCoachNote(userId, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(['coach', 'clients', userId], detail);
    },
  });
}

export function useGrantClientAccess(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => grantSubscription({ userId, planId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) => refreshesClientLists(query.queryKey, userId),
      });
    },
  });
}

export function useAssignCoachProgram(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => assignCoachProgram(userId, templateId),
    onSuccess: async (detail) => {
      queryClient.setQueryData(['coach', 'clients', userId], detail);
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'clients', userId],
      });
    },
  });
}

export function useCoachNutrition(userId: string) {
  return useQuery({
    queryKey: ['coach', 'clients', userId, 'nutrition'],
    queryFn: () => getCoachNutrition(userId),
  });
}

export function useSetManualNutritionTarget(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      targetCalories: string;
      proteinGrams: string;
      fatGrams: string;
      carbsGrams: string;
    }) => setManualNutritionTarget(userId, body),
    onSuccess: async () => {
      await invalidateNutrition(queryClient, userId);
    },
  });
}

export function useApplyNutritionCalculation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (calculationId: string) =>
      applyNutritionCalculation(userId, calculationId),
    onSuccess: async () => {
      await invalidateNutrition(queryClient, userId);
    },
  });
}

function invalidateNutrition(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['coach', 'clients', userId, 'nutrition'],
    }),
    queryClient.invalidateQueries({ queryKey: ['coach', 'nutrition'] }),
  ]);
}

export function useCoachClient(userId: string) {
  return useQuery({
    queryKey: ['coach', 'clients', userId],
    queryFn: () => getCoachClient(userId),
    retry: (failureCount, error) =>
      !(error instanceof ApiClientError && error.status === 404) &&
      failureCount < 2,
  });
}

export function useCoachWorkouts(userId: string) {
  return useInfiniteQuery({
    queryKey: [
      'coach',
      'clients',
      userId,
      'workouts',
      { limit: COACH_WORKOUT_PAGE },
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listCoachWorkouts(userId, COACH_WORKOUT_PAGE, pageParam),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.logs.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return loaded;
    },
  });
}

export function useCoachMeasurements(userId: string) {
  return useQuery({
    queryKey: ['coach', 'clients', userId, 'measurements'],
    queryFn: () => listCoachMeasurements(userId),
  });
}

export function useCoachStrength(userId: string) {
  return useQuery({
    queryKey: ['coach', 'clients', userId, 'strength'],
    queryFn: () => listCoachStrength(userId),
  });
}

export function useCoachProgressPhotos(userId: string) {
  return useQuery({
    queryKey: ['coach', 'clients', userId, 'progress-photos'],
    queryFn: () => listCoachProgressPhotos(userId),
  });
}
