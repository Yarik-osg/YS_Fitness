import type {
  CoachClientDetail,
  CoachClientsResponse,
} from '@repo/shared-types';
import { apiRequest } from './client';

export function listCoachClients() {
  return apiRequest<CoachClientsResponse>('/coach/clients');
}

export function getCoachClient(userId: string) {
  return apiRequest<CoachClientDetail>(
    `/coach/clients/${encodeURIComponent(userId)}`,
  );
}
