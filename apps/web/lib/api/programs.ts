import type {
  AssignedProgramResponse,
  CurrentProgramResponse,
  ExerciseResponse,
  MuscleGroup,
} from '@repo/shared-types';
import { apiRequest } from './client';

export async function getMyProgram() {
  const response = await apiRequest<CurrentProgramResponse>('/programs/me');
  return response.program;
}

export function assignProgram() {
  return apiRequest<AssignedProgramResponse>('/programs/assign', {
    method: 'POST',
  });
}

export function listExercises(muscleGroup?: MuscleGroup) {
  const query = muscleGroup
    ? `?muscleGroup=${encodeURIComponent(muscleGroup)}`
    : '';
  return apiRequest<ExerciseResponse[]>(`/programs/exercises${query}`);
}
