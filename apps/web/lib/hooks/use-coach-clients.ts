'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/client';
import { getCoachClient, listCoachClients } from '@/lib/api/coach';

export function useCoachClients() {
  return useQuery({
    queryKey: ['coach', 'clients'],
    queryFn: listCoachClients,
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
