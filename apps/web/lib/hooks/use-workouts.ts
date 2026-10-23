'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStrengthChanges,
  getWorkoutCalendar,
  listWorkoutLogs,
  logWorkout,
} from '@/lib/api/workouts';
import {
  assignedProgramQueryKey,
  myProgramQueryKey,
  promotionQueryKey,
} from '@/lib/hooks/use-programs';

export const workoutLogsQueryKey = ['workouts', 'logs'] as const;
export const strengthChangesQueryKey = ['workouts', 'strength'] as const;

export function useStrengthChanges() {
  return useQuery({
    queryKey: strengthChangesQueryKey,
    queryFn: getStrengthChanges,
  });
}

export function useWorkoutLogs(limit = 20) {
  return useQuery({
    queryKey: [...workoutLogsQueryKey, limit],
    queryFn: () => listWorkoutLogs(limit),
  });
}

/**
 * Logs inside [from, to). The key sits under `workoutLogsQueryKey`, so logging
 * a workout refreshes every calendar range that is on screen.
 */
export function useWorkoutCalendar(range: {
  from: string;
  to: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [...workoutLogsQueryKey, 'calendar', range.from, range.to],
    queryFn: () => getWorkoutCalendar(range.from, range.to),
    enabled: range.enabled ?? true,
  });
}

export function useLogWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logWorkout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutLogsQueryKey });
      void queryClient.invalidateQueries({ queryKey: strengthChangesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myProgramQueryKey });
      void queryClient.invalidateQueries({
        queryKey: assignedProgramQueryKey,
      });
      void queryClient.invalidateQueries({ queryKey: promotionQueryKey });
    },
  });
}
