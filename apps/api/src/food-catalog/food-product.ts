import type { FoodProduct } from '@prisma/client';
import type { FoodProductResponse } from '@repo/shared-types';

/** Catalog view. The log module adds `isFavorite` before the response leaves the API. */
export type CatalogFoodProduct = Omit<FoodProductResponse, 'isFavorite'>;

export function toFoodProduct(row: FoodProduct): CatalogFoodProduct {
  return {
    id: row.id,
    source: row.source,
    externalId: row.externalId,
    name: row.name,
    brand: row.brand,
    imageUrl: row.imageUrl,
    kcalPer100g: row.kcalPer100g.toNumber(),
    proteinPer100g: row.proteinPer100g.toNumber(),
    fatPer100g: row.fatPer100g.toNumber(),
    carbsPer100g: row.carbsPer100g.toNumber(),
  };
}
