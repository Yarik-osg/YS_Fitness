import type {
  FoodDayResponse,
  FoodLogEntryResponse,
  FoodProductListResponse,
  FoodProductResponse,
  FoodRecentResponse,
  FoodSearchResponse,
} from '@repo/shared-types';
import type {
  CreateFoodLogInput,
  CreateFoodProductInput,
  PatchFoodLogInput,
} from '@repo/validation';
import { apiRequest } from './client';

export function searchFoods(
  query: { q?: string; barcode?: string },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.barcode) params.set('barcode', query.barcode);
  return apiRequest<FoodSearchResponse>(
    `/food/products/search?${params.toString()}`,
    { signal },
  );
}

export function createFoodProduct(body: CreateFoodProductInput) {
  return apiRequest<FoodProductResponse>('/food/products', {
    method: 'POST',
    body,
  });
}

export function listFavoriteFoods() {
  return apiRequest<FoodProductListResponse>('/food/favorites');
}

export function favoriteFood(productId: string) {
  return apiRequest<FoodProductResponse>(
    `/food/favorites/${encodeURIComponent(productId)}`,
    { method: 'PUT' },
  );
}

export function unfavoriteFood(productId: string) {
  return apiRequest<void>(`/food/favorites/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  });
}

export function listRecentFoods(limit = 20) {
  return apiRequest<FoodRecentResponse>(`/food/recent?limit=${limit}`);
}

export function getFoodDay(date: string) {
  return apiRequest<FoodDayResponse>(
    `/food/log?date=${encodeURIComponent(date)}`,
  );
}

export function createFoodLog(body: CreateFoodLogInput) {
  return apiRequest<FoodLogEntryResponse>('/food/log', {
    method: 'POST',
    body,
  });
}

export function updateFoodLog(id: string, body: PatchFoodLogInput) {
  return apiRequest<FoodLogEntryResponse>(
    `/food/log/${encodeURIComponent(id)}`,
    { method: 'PATCH', body },
  );
}

export function deleteFoodLog(id: string) {
  return apiRequest<void>(`/food/log/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
