import {
  barcodeLookupIds,
  foodSearchQuerySchema,
  isValidBarcode,
  normalizeBarcode,
} from '@repo/validation';
import { describe, expect, it } from 'vitest';

function firstValid(length: 8 | 12 | 13): string {
  const start = 10 ** (length - 1);
  for (let value = start; value < start + 200_000; value += 1) {
    const code = String(value);
    if (normalizeBarcode(code)) return code;
  }
  throw new Error(`no valid ${length}-digit barcode in range`);
}

describe('normalizeBarcode', () => {
  const ean8 = firstValid(8);
  const upc = firstValid(12);
  const ean13 = firstValid(13);

  it('rejects length, checksum, and non-digits', () => {
    const broken = `${ean8.slice(0, -1)}${ean8.endsWith('0') ? '1' : '0'}`;
    expect(normalizeBarcode('  123  ')).toBeNull();
    expect(normalizeBarcode('1234567')).toBeNull();
    expect(normalizeBarcode(`${ean8}9`)).toBeNull();
    expect(normalizeBarcode(broken)).toBeNull();
    expect(normalizeBarcode('55556666')).toBeNull();
    expect(normalizeBarcode('abcdefgh')).toBeNull();
    expect(isValidBarcode(ean8)).toBe(true);
    expect(isValidBarcode('55556666')).toBe(false);
  });

  it('turns UPC-A into the same EAN-13 and leaves EAN-8 unchanged', () => {
    const widened = normalizeBarcode(upc);
    expect(widened).toBe(`0${upc}`);
    expect(normalizeBarcode(widened ?? '')).toBe(widened);
    expect(barcodeLookupIds(widened ?? '')).toEqual([widened, upc]);
    expect(normalizeBarcode(ean8)).toBe(ean8);
    expect(barcodeLookupIds(ean8)).toEqual([ean8]);
    expect(normalizeBarcode(` ${ean13} `)).toBe(ean13);
  });

  it('stores the normalized barcode on the search query', () => {
    expect(foodSearchQuerySchema.parse({ barcode: upc }).barcode).toBe(
      `0${upc}`,
    );
    expect(foodSearchQuerySchema.parse({ barcode: ean8 }).barcode).toBe(ean8);
    expect(
      foodSearchQuerySchema.safeParse({ barcode: '55556666' }).success,
    ).toBe(false);
    expect(foodSearchQuerySchema.safeParse({}).success).toBe(false);
  });
});
