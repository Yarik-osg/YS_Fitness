'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/client';
import {
  archiveCoachClient,
  assignCoachProgram,
  getCoachClient,
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
        predicate: (query) => isArchiveRefreshKey(query.queryKey, userId),
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
