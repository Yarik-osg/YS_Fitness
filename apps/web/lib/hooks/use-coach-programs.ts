'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/client';
import {
  getCoachProgram,
  listCoachExercises,
  listCoachPrograms,
} from '@/lib/api/coach-programs';

export function useCoachPrograms(enabled = true) {
  return useQuery({
    queryKey: ['coach', 'program-templates'],
    queryFn: listCoachPrograms,
    enabled,
  });
}

export function useCoachProgram(templateId: string | undefined) {
  return useQuery({
    queryKey: ['coach', 'program-templates', templateId],
    queryFn: () => getCoachProgram(templateId ?? ''),
    enabled: Boolean(templateId),
    retry: (failureCount, error) =>
      !(error instanceof ApiClientError && error.status === 404) &&
      failureCount < 2,
  });
}

export function useCoachExercises() {
  return useQuery({
    queryKey: ['coach', 'exercises'],
    queryFn: listCoachExercises,
  });
}
