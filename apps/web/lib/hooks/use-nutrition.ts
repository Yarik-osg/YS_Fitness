'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calculateNutrition,
  listNutritionCalculations,
} from '@/lib/api/nutrition';

export const nutritionCalculationsQueryKey = [
  'nutrition',
  'calculations',
] as const;

export function useNutritionCalculations() {
  return useQuery({
    queryKey: nutritionCalculationsQueryKey,
    queryFn: listNutritionCalculations,
  });
}

let calculationInFlight: ReturnType<typeof calculateNutrition> | null = null;

function calculateNutritionOnce() {
  calculationInFlight ??= calculateNutrition().finally(() => {
    calculationInFlight = null;
  });
  return calculationInFlight;
}

export function useCalculateNutrition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calculateNutritionOnce,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: nutritionCalculationsQueryKey,
      });
    },
  });
}
