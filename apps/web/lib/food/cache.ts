import type {
  FoodProductResponse,
  FoodRecentItemResponse,
} from '@repo/shared-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function applyFavorite(
  data: unknown,
  product: FoodProductResponse,
  isFavorite: boolean,
): unknown {
  if (!isRecord(data)) return data;
  if ('entries' in data && 'totals' in data) return data;

  if (Array.isArray(data.products)) {
    const current = data.products as FoodProductResponse[];
    const products = current.map((item) =>
      item.id === product.id ? { ...item, isFavorite } : item,
    );
    if (!('fromCacheOnly' in data)) {
      if (!isFavorite) {
        return { products: products.filter((item) => item.id !== product.id) };
      }
      if (!current.some((item) => item.id === product.id)) {
        return { products: [{ ...product, isFavorite: true }, ...products] };
      }
    }
    return { ...data, products };
  }

  if (Array.isArray(data.items)) {
    const current = data.items as FoodRecentItemResponse[];
    return {
      items: current.map((item) =>
        item.product.id === product.id
          ? { ...item, product: { ...item.product, isFavorite } }
          : item,
      ),
    };
  }

  return data;
}
