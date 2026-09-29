'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignProgram,
  getAssignedProgram,
  getMyProgram,
  toProgramSummary,
} from '@/lib/api/programs';

export const myProgramQueryKey = ['programs', 'me'] as const;
export const assignedProgramQueryKey = ['programs', 'assigned'] as const;

export function useMyProgram() {
  return useQuery({
    queryKey: myProgramQueryKey,
    queryFn: getMyProgram,
  });
}

export function useAssignedProgram() {
  return useQuery({
    queryKey: assignedProgramQueryKey,
    queryFn: getAssignedProgram,
  });
}

export function useAssignProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignProgram,
    onSuccess: (program) => {
      queryClient.setQueryData(myProgramQueryKey, program);
      queryClient.setQueryData(
        assignedProgramQueryKey,
        toProgramSummary(program),
      );
    },
  });
}
