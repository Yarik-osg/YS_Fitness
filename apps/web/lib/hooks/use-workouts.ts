'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listWorkoutLogs, logWorkout } from '@/lib/api/workouts';

export const workoutLogsQueryKey = ['workouts', 'logs'] as const;

export function useWorkoutLogs() {
  return useQuery({
    queryKey: workoutLogsQueryKey,
    queryFn: () => listWorkoutLogs(),
  });
}

export function useLogWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logWorkout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutLogsQueryKey });
    },
  });
}
