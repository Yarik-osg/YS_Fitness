import type {
  FoodLogEntryResponse,
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
  retain = false,
): unknown {
  if (!isRecord(data)) return data;
  if (Array.isArray(data.entries) && 'totals' in data) {
    return {
      ...data,
      entries: (data.entries as FoodLogEntryResponse[]).map((entry) =>
        entry.productId === product.id ? { ...entry, isFavorite } : entry,
      ),
    };
  }

  if (Array.isArray(data.products)) {
    const current = data.products as FoodProductResponse[];
    const products = current.map((item) =>
      item.id === product.id ? { ...item, isFavorite } : item,
    );
    if (!retain && !('fromCacheOnly' in data)) {
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

/** Flip a logged product when the row has no catalog card to prepend. */
export function applyFavoriteId(
  data: unknown,
  productId: string,
  isFavorite: boolean,
  retain = false,
): unknown {
  if (!isRecord(data)) return data;
  if (Array.isArray(data.entries) && 'totals' in data) {
    return {
      ...data,
      entries: (data.entries as FoodLogEntryResponse[]).map((entry) =>
        entry.productId === productId ? { ...entry, isFavorite } : entry,
      ),
    };
  }
  if (Array.isArray(data.products)) {
    const current = data.products as FoodProductResponse[];
    const products = current.map((item) =>
      item.id === productId ? { ...item, isFavorite } : item,
    );
    if (!retain && !('fromCacheOnly' in data) && !isFavorite) {
      return { products: products.filter((item) => item.id !== productId) };
    }
    return { ...data, products };
  }
  if (Array.isArray(data.items)) {
    const current = data.items as FoodRecentItemResponse[];
    return {
      items: current.map((item) =>
        item.product.id === productId
          ? { ...item, product: { ...item.product, isFavorite } }
          : item,
      ),
    };
  }
  return data;
}
