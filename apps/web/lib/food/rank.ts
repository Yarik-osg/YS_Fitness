import type { FoodProductResponse } from '@repo/shared-types';
import { rankBySearch } from '@repo/validation/food-search';
import { decodeFoodText } from './text';

/** Same order as the API. Decoding is display-only and does not rename the row. */
export function rankFoodProducts(
  products: FoodProductResponse[],
  query: string,
): FoodProductResponse[] {
  const originals = new Map(products.map((product) => [product.id, product]));
  const ordered = rankBySearch(
    products.map((product) => ({
      ...product,
      name: decodeFoodText(product.name),
      brand: product.brand ? decodeFoodText(product.brand) : product.brand,
    })),
    query,
  );
  return ordered.map((product) => originals.get(product.id) ?? product);
}

export type MacroSort = 'protein' | 'fat' | 'carbs';

/** Highest per-100g macro first. Customs and favorites move ahead of the rest. */
export function sortByMacro(
  products: FoodProductResponse[],
  sort: MacroSort,
  all = false,
): FoodProductResponse[] {
  const key =
    sort === 'protein'
      ? 'proteinPer100g'
      : sort === 'fat'
        ? 'fatPer100g'
        : 'carbsPer100g';
  if (all) return [...products].sort((left, right) => right[key] - left[key]);
  const mine: FoodProductResponse[] = [];
  const rest: FoodProductResponse[] = [];
  for (const product of products) {
    if (product.source === 'CUSTOM' || product.isFavorite) mine.push(product);
    else rest.push(product);
  }
  mine.sort((left, right) => right[key] - left[key]);
  return [...mine, ...rest];
}
