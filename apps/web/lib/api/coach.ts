import type {
  CoachClientDetail,
  CoachClientWorkoutsResponse,
  CoachClientsResponse,
  CoachProgramClientsResponse,
  ProgressPhotosResponse,
  StrengthChangesResponse,
  WeightMeasurementsResponse,
} from '@repo/shared-types';
import { apiBlob, apiRequest } from './client';

export function listCoachClients() {
  return apiRequest<CoachClientsResponse>('/coach/clients');
}

export function getCoachClient(userId: string) {
  return apiRequest<CoachClientDetail>(
    `/coach/clients/${encodeURIComponent(userId)}`,
  );
}

export function listProgramClients(templateId: string) {
  return apiRequest<CoachProgramClientsResponse>(
    `/coach/programs/${encodeURIComponent(templateId)}/clients`,
  );
}

export function archiveCoachClient(userId: string) {
  return apiRequest<{ id: string }>(
    `/coach/clients/${encodeURIComponent(userId)}/archive`,
    { method: 'POST' },
  );
}

export function restoreCoachClient(userId: string) {
  return apiRequest<{ id: string }>(
    `/coach/clients/${encodeURIComponent(userId)}/restore`,
    { method: 'POST' },
  );
}

export function updateCoachNote(
  userId: string,
  body: { note: string; base: string },
) {
  return apiRequest<CoachClientDetail>(
    `/coach/clients/${encodeURIComponent(userId)}/note`,
    { method: 'PATCH', body },
  );
}

export function assignCoachProgram(userId: string, templateId: string) {
  return apiRequest<CoachClientDetail>(
    `/coach/clients/${encodeURIComponent(userId)}/program`,
    { method: 'POST', body: { templateId } },
  );
}

function clientPath(userId: string, suffix: string) {
  return `/coach/clients/${encodeURIComponent(userId)}${suffix}`;
}

export function listCoachWorkouts(
  userId: string,
  limit: number,
  offset: number,
) {
  return apiRequest<CoachClientWorkoutsResponse>(
    `${clientPath(userId, '/workouts')}?limit=${limit}&offset=${offset}`,
  );
}

export function listCoachMeasurements(userId: string) {
  return apiRequest<WeightMeasurementsResponse>(
    clientPath(userId, '/measurements'),
  );
}

export function listCoachStrength(userId: string) {
  return apiRequest<StrengthChangesResponse>(clientPath(userId, '/strength'));
}

export function listCoachProgressPhotos(userId: string) {
  return apiRequest<ProgressPhotosResponse>(
    clientPath(userId, '/progress-photos'),
  );
}

export function getCoachProgressPhotoBlob(userId: string, photoId: string) {
  return apiBlob(
    clientPath(userId, `/progress-photos/${encodeURIComponent(photoId)}`),
  );
}
