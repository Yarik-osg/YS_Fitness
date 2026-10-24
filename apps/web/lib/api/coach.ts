import type { CoachClientsResponse } from '@repo/shared-types';
import { apiRequest } from './client';

export function listCoachClients() {
  return apiRequest<CoachClientsResponse>('/coach/clients');
}
