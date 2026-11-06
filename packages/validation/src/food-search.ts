const ALIASES: Record<string, string> = {
  'кока кола': 'coca cola',
  снікерс: 'snickers',
  'мілки вей': 'milky way',
  'мілкі вей': 'milky way',
  нуттела: 'nutella',
  пепсі: 'pepsi',
  пепси: 'pepsi',
  рошен: 'roshen',
};

/** Cache key and local match text. Display names stay untouched. */
export function foodSearchKey(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[-–—_./]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Whole-query spellings Open Food Facts does not index, sent as the Latin name.
 * A longer phrase is not rewritten.
 */
export function foodSearchTerms(value: string): string {
  const key = foodSearchKey(value);
  return ALIASES[key] ?? key;
}

export function rankBySearch<T extends { name: string; brand: string | null }>(
  products: T[],
  query: string,
): T[] {
  const needle = foodSearchTerms(query);
  if (!needle) return products;
  return products
    .map((product, index) => ({
      product,
      index,
      rank: searchRank(product, needle),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((row) => row.product);
}

function searchRank(
  product: { name: string; brand: string | null },
  needle: string,
): number {
  const name = foodSearchKey(product.name);
  const brands = (product.brand ?? '')
    .split(',')
    .map((part) => foodSearchKey(part))
    .filter((part) => part.length > 0);
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (brands.some((brand) => brand === needle)) return 2;
  if (name.includes(needle)) return 3;
  if (brands.some((brand) => brand.includes(needle))) return 4;
  return 5;
}
