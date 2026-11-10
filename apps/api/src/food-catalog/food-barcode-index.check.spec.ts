import { describe, expect, it, vi } from 'vitest';
import {
  FOOD_CUSTOM_BARCODE_INDEX,
  FoodBarcodeIndexCheck,
  isCustomBarcodeIndex,
  type FoodBarcodeIndex,
} from './food-barcode-index.check.js';

const present: FoodBarcodeIndex = {
  tableName: 'food_products',
  unique: true,
  keyAttributeCount: 2,
  keyColumns: ['owner_id', 'barcode'],
  predicate:
    '((source = \'CUSTOM\'::"FoodProductSource") AND (barcode IS NOT NULL))',
};

function checkWith(rows: FoodBarcodeIndex[]) {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
  return new FoodBarcodeIndexCheck(prisma as never);
}

describe('FoodBarcodeIndexCheck', () => {
  it('refuses to boot when the partial unique index is missing', async () => {
    await expect(checkWith([]).onApplicationBootstrap()).rejects.toThrow(
      `Missing partial unique index ${FOOD_CUSTOM_BARCODE_INDEX}`,
    );
    await expect(checkWith([]).onApplicationBootstrap()).rejects.toThrow(
      'prisma migrate deploy',
    );
  });

  it('accepts the catalog row postgres reports for the migration', async () => {
    expect(isCustomBarcodeIndex(present)).toBe(true);
    await expect(
      checkWith([present]).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });

  it('refuses to boot when the index is not the custom barcode predicate', async () => {
    await expect(
      checkWith([
        { ...present, predicate: 'barcode IS NOT NULL' },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow(
      `Index ${FOOD_CUSTOM_BARCODE_INDEX} must be a unique index`,
    );
  });
});
