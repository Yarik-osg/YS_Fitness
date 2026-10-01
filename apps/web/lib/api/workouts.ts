import type {
  WorkoutLogListResponse,
  WorkoutLogResponse,
} from '@repo/shared-types';
import type { LogWorkoutInput } from '@repo/validation';
import { apiRequest } from './client';

export function logWorkout(input: LogWorkoutInput) {
  return apiRequest<WorkoutLogResponse>('/workouts/log', {
    method: 'POST',
    body: input,
  });
}

export function listWorkoutLogs(limit = 20, offset = 0) {
  return apiRequest<WorkoutLogListResponse>(
    `/workouts/logs?limit=${limit}&offset=${offset}`,
  );
}
