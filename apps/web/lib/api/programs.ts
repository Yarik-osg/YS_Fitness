import type {
  AssignedProgramLookupResponse,
  AssignedProgramResponse,
  AssignedProgramSummary,
  CurrentProgramResponse,
  ExerciseResponse,
  MuscleGroup,
} from '@repo/shared-types';
import { ApiClientError, apiRequest } from './client';

export async function getMyProgram() {
  const response = await apiRequest<CurrentProgramResponse>('/programs/me');
  return response.program;
}

export async function getAssignedProgram() {
  try {
    const response =
      await apiRequest<AssignedProgramLookupResponse>('/programs/assigned');
    return response?.program ?? null;
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      (error.status === 403 || error.status === 404)
    ) {
      return null;
    }
    throw error;
  }
}

export function assignProgram() {
  return apiRequest<AssignedProgramResponse>('/programs/assign', {
    method: 'POST',
  });
}

export function toProgramSummary(
  program: AssignedProgramResponse,
): AssignedProgramSummary {
  return {
    id: program.id,
    templateId: program.templateId,
    templateCode: program.templateCode,
    templateName: program.templateName,
    gender: program.gender,
    level: program.level,
    frequencyPerWeek: program.frequencyPerWeek,
    accent: program.accent,
    assignedAt: program.assignedAt,
  };
}

export function listExercises(muscleGroup?: MuscleGroup) {
  const query = muscleGroup
    ? `?muscleGroup=${encodeURIComponent(muscleGroup)}`
    : '';
  return apiRequest<ExerciseResponse[]>(`/programs/exercises${query}`);
}
