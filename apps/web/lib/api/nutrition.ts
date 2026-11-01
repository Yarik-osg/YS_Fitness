import type {
  NutritionCalculationCreatedResponse,
  NutritionCalculationListResponse,
} from '@repo/shared-types';
import { apiRequest } from './client';

export function listNutritionCalculations() {
  return apiRequest<NutritionCalculationListResponse>(
    '/nutrition/calculations',
  );
}

export function calculateNutrition() {
  return apiRequest<NutritionCalculationCreatedResponse>(
    '/nutrition/calculations',
    { method: 'POST' },
  );
}
