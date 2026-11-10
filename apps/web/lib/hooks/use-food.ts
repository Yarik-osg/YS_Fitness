'use client';

import type { FoodProductResponse } from '@repo/shared-types';
import {
  isValidBarcode,
  normalizeBarcode,
  type CreateFoodLogInput,
  type CreateFoodProductInput,
  type PatchFoodLogInput,
} from '@repo/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFoodLog,
  createFoodProduct,
  deleteFoodLog,
  favoriteFood,
  getFoodDay,
  listCustomFoods,
  listFavoriteFoods,
  listRecentFoods,
  searchFoods,
  unfavoriteFood,
  updateFoodLog,
} from '@/lib/api/food';
import { applyFavorite, applyFavoriteId } from '@/lib/food/cache';

export const foodRootKey = ['food'] as const;

export function foodDayKey(date: string) {
  return ['food', 'day', date] as const;
}

export function foodSearchKey(query: string) {
  return ['food', 'search', query] as const;
}

export const foodCustomKey = ['food', 'custom'] as const;
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
    enabled: trimmed.length >= 2 && !isValidBarcode(trimmed),
  });
}

export function foodBarcodeKey(code: string) {
  return ['food', 'barcode', code] as const;
}

export function useFoodBarcodeLookup(code: string | null) {
  const normalized = code ? normalizeBarcode(code) : null;
  return useQuery({
    queryKey: foodBarcodeKey(normalized ?? ''),
    queryFn: ({ signal }) => searchFoods({ barcode: normalized ?? '' }, signal),
    enabled: normalized !== null,
  });
}

export type BarcodeLookup = ReturnType<typeof useFoodBarcodeLookup>;

export function useCustomFoods(enabled: boolean) {
  return useQuery({
    queryKey: foodCustomKey,
    queryFn: () => listCustomFoods(),
    enabled,
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
          queryClient.invalidateQueries({ queryKey: foodCustomKey }),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFoodProductInput) => createFoodProduct(body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: foodCustomKey }),
        queryClient.invalidateQueries({ queryKey: ['food', 'barcode'] }),
      ]),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input:
        | { product: FoodProductResponse; next: boolean }
        | { productId: string; next: boolean },
    ) => {
      const id = 'product' in input ? input.product.id : input.productId;
      return input.next
        ? favoriteFood(id).then(() => undefined)
        : unfavoriteFood(id);
    },
    onMutate: async (input) => {
      const next = input.next;
      await queryClient.cancelQueries({ queryKey: foodRootKey });
      const snapshots = queryClient.getQueriesData({ queryKey: foodRootKey });
      for (const [key, data] of snapshots) {
        const retain = Array.isArray(key) && key[1] === 'custom';
        queryClient.setQueryData(
          key,
          'product' in input
            ? applyFavorite(data, input.product, next, retain)
            : applyFavoriteId(data, input.productId, next, retain),
        );
      }
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (_data, input) => {
      if ('product' in input) return;
      return queryClient.invalidateQueries({ queryKey: foodFavoritesKey });
    },
  });
}
