'use client';

import { useQuery } from '@tanstack/react-query';
import { listCoachClients } from '@/lib/api/coach';

export function useCoachClients() {
  return useQuery({
    queryKey: ['coach', 'clients'],
    queryFn: listCoachClients,
  });
}
