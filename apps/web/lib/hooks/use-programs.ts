'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignProgram, getMyProgram } from '@/lib/api/programs';

export const myProgramQueryKey = ['programs', 'me'] as const;

export function useMyProgram() {
  return useQuery({
    queryKey: myProgramQueryKey,
    queryFn: getMyProgram,
  });
}

export function useAssignProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignProgram,
    onSuccess: (program) => {
      queryClient.setQueryData(myProgramQueryKey, program);
    },
  });
}
