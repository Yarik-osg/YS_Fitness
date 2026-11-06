'use client';

import type { FoodProductResponse } from '@repo/shared-types';
import type {
  CreateFoodLogInput,
  CreateFoodProductInput,
  PatchFoodLogInput,
} from '@repo/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFoodLog,
  createFoodProduct,
  deleteFoodLog,
  favoriteFood,
  getFoodDay,
  listFavoriteFoods,
  listRecentFoods,
  searchFoods,
  unfavoriteFood,
  updateFoodLog,
} from '@/lib/api/food';
import { applyFavorite } from '@/lib/food/cache';

export const foodRootKey = ['food'] as const;

export function foodDayKey(date: string) {
  return ['food', 'day', date] as const;
}

export function foodSearchKey(query: string) {
  return ['food', 'search', query] as const;
}

export const foodFavoritesKey = ['food', 'favorites'] as const;
export const foodRecentKey = ['food', 'recent'] as const;

export function useFoodDay(date: string) {
  return useQuery({
    queryKey: foodDayKey(date),
    queryFn: () => getFoodDay(date),
  });
}

export function useFoodSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: foodSearchKey(trimmed),
    queryFn: ({ signal }) => searchFoods({ q: trimmed }, signal),
    enabled: trimmed.length >= 2,
  });
}

export function useFavoriteFoods(enabled: boolean) {
  return useQuery({
    queryKey: foodFavoritesKey,
    queryFn: () => listFavoriteFoods(),
    enabled,
  });
}

export function useRecentFoods(enabled: boolean) {
  return useQuery({
    queryKey: foodRecentKey,
    queryFn: () => listRecentFoods(20),
    enabled,
  });
}

function refreshLoggedFood(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['food', 'day'] }),
    queryClient.invalidateQueries({ queryKey: foodRecentKey }),
  ]);
}

export function useCreateFoodLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFoodLogInput) => createFoodLog(body),
    onSuccess: () => refreshLoggedFood(queryClient),
  });
}

export function useUpdateFoodLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchFoodLogInput }) =>
      updateFoodLog(id, body),
    onSuccess: (_entry, variables) => {
      const refresh = refreshLoggedFood(queryClient);
      if (variables.body.saveAsMyProduct) {
        return Promise.all([
          refresh,
          queryClient.invalidateQueries({ queryKey: ['food', 'search'] }),
        ]);
      }
      return refresh;
    },
  });
}

export function useDeleteFoodLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFoodLog(id),
    onSuccess: () => refreshLoggedFood(queryClient),
  });
}

export function useCreateFoodProduct() {
  return useMutation({
    mutationFn: (body: CreateFoodProductInput) => createFoodProduct(body),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      product,
      next,
    }: {
      product: FoodProductResponse;
      next: boolean;
    }) =>
      next
        ? favoriteFood(product.id).then(() => undefined)
        : unfavoriteFood(product.id),
    onMutate: async ({ product, next }) => {
      await queryClient.cancelQueries({ queryKey: foodRootKey });
      const snapshots = queryClient.getQueriesData({ queryKey: foodRootKey });
      for (const [key, data] of snapshots) {
        queryClient.setQueryData(key, applyFavorite(data, product, next));
      }
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
  });
}
