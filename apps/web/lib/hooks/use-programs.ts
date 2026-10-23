'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptPromotion,
  assignProgram,
  getAssignedProgram,
  getMyProgram,
  getProgramPromotion,
  toProgramSummary,
} from '@/lib/api/programs';

export const myProgramQueryKey = ['programs', 'me'] as const;
export const assignedProgramQueryKey = ['programs', 'assigned'] as const;
export const promotionQueryKey = ['programs', 'promotion'] as const;

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

export function useProgramPromotion(enabled: boolean) {
  return useQuery({
    queryKey: promotionQueryKey,
    queryFn: getProgramPromotion,
    enabled,
  });
}

export function useAcceptPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptPromotion,
    onSuccess: (program) => {
      queryClient.setQueryData(myProgramQueryKey, program);
      queryClient.setQueryData(
        assignedProgramQueryKey,
        toProgramSummary(program),
      );
      queryClient.setQueryData(promotionQueryKey, null);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: promotionQueryKey });
      void queryClient.invalidateQueries({ queryKey: myProgramQueryKey });
      void queryClient.invalidateQueries({ queryKey: assignedProgramQueryKey });
    },
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
