import type {
  ExerciseResponse,
  TrainerProgramTemplateDetail,
  TrainerProgramTemplateListResponse,
} from '@repo/shared-types';
import type {
  TrainerTemplateBody,
  TrainerTemplateRename,
} from '@repo/validation';
import { apiRequest } from '@/lib/api/client';

export function listCoachPrograms() {
  return apiRequest<TrainerProgramTemplateListResponse>(
    '/coach/program-templates',
  );
}

export function getCoachProgram(templateId: string) {
  return apiRequest<TrainerProgramTemplateDetail>(
    `/coach/program-templates/${encodeURIComponent(templateId)}`,
  );
}

export function listCoachExercises() {
  return apiRequest<ExerciseResponse[]>('/coach/program-templates/exercises');
}

export function createCoachProgram(body: TrainerTemplateBody) {
  return apiRequest<TrainerProgramTemplateDetail>('/coach/program-templates', {
    method: 'POST',
    body,
  });
}

export function updateCoachProgram(
  templateId: string,
  body: TrainerTemplateBody,
) {
  return apiRequest<TrainerProgramTemplateDetail>(
    `/coach/program-templates/${encodeURIComponent(templateId)}`,
    { method: 'PUT', body },
  );
}

export function renameCoachProgram(
  templateId: string,
  body: TrainerTemplateRename,
) {
  return apiRequest<TrainerProgramTemplateDetail>(
    `/coach/program-templates/${encodeURIComponent(templateId)}/name`,
    { method: 'PUT', body },
  );
}

export function duplicateCoachProgram(templateId: string) {
  return apiRequest<TrainerProgramTemplateDetail>(
    `/coach/program-templates/${encodeURIComponent(templateId)}/duplicate`,
    { method: 'POST' },
  );
}

export function deleteCoachProgram(templateId: string) {
  return apiRequest<void>(
    `/coach/program-templates/${encodeURIComponent(templateId)}`,
    { method: 'DELETE' },
  );
}
