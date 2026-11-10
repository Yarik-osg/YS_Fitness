import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const FOOD_CUSTOM_BARCODE_INDEX = 'food_products_custom_barcode_key';

export interface FoodBarcodeIndex {
  tableName: string;
  unique: boolean;
  keyAttributeCount: number;
  keyColumns: string[];
  predicate: string | null;
}

const CUSTOM_BARCODE_PREDICATE =
  "source = 'custom'::foodproductsource and barcode is not null";

@Injectable()
export class FoodBarcodeIndexCheck implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const rows = await this.prisma.$queryRaw<FoodBarcodeIndex[]>`
      SELECT
        t.relname AS "tableName",
        i.indisunique AS "unique",
        i.indnkeyatts::int AS "keyAttributeCount",
        COALESCE(
          (
            SELECT array_agg(a.attname ORDER BY cols.ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ordinality)
            JOIN pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = cols.attnum
            WHERE cols.ordinality <= i.indnkeyatts
              AND cols.attnum > 0
          ),
          ARRAY[]::text[]
        ) AS "keyColumns",
        pg_get_expr(i.indpred, i.indrelid) AS predicate
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_class ix ON ix.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = ix.relnamespace
      WHERE n.nspname = 'public'
        AND ix.relname = ${FOOD_CUSTOM_BARCODE_INDEX}
    `;
    const index = rows[0];
    if (!index) {
      throw new Error(
        `Missing partial unique index ${FOOD_CUSTOM_BARCODE_INDEX} on food_products. ` +
          'It is hand-written in the food_product_barcode migration and is lost by ' +
          '`prisma db push` or schema-only rebuilds — run `prisma migrate deploy` (or recreate it) before starting the API.',
      );
    }
    if (!isCustomBarcodeIndex(index)) {
      throw new Error(
        `Index ${FOOD_CUSTOM_BARCODE_INDEX} must be a unique index on food_products (owner_id, barcode) WHERE source = 'CUSTOM' AND barcode IS NOT NULL.`,
      );
    }
  }
}

export function isCustomBarcodeIndex(index: FoodBarcodeIndex): boolean {
  return (
    index.tableName === 'food_products' &&
    index.unique === true &&
    index.keyAttributeCount === 2 &&
    Array.isArray(index.keyColumns) &&
    index.keyColumns.length === 2 &&
    index.keyColumns[0] === 'owner_id' &&
    index.keyColumns[1] === 'barcode' &&
    normalizePredicate(index.predicate) === CUSTOM_BARCODE_PREDICATE
  );
}

function normalizePredicate(predicate: string | null): string {
  if (!predicate) return '';
  return predicate
    .replace(/"/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
