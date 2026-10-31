import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const NUTRITION_ONE_ACTIVE_TARGET_INDEX = 'nutrition_one_active_target';

export interface NutritionActiveTargetIndex {
  tableName: string;
  unique: boolean;
  keyColumns: string[];
  predicate: string | null;
}

const ACTIVE_TRUE_PREDICATES = new Set([
  'active',
  'active = true',
  'active is true',
]);

@Injectable()
export class NutritionIndexCheck implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const rows = await this.prisma.$queryRaw<NutritionActiveTargetIndex[]>`
      SELECT
        t.relname AS "tableName",
        i.indisunique AS "unique",
        COALESCE(
          (
            SELECT array_agg(a.attname ORDER BY cols.ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ordinality)
            JOIN pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = cols.attnum
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
        AND ix.relname = ${NUTRITION_ONE_ACTIVE_TARGET_INDEX}
    `;
    const index = rows[0];
    if (!index) {
      throw new Error(
        `Missing partial unique index ${NUTRITION_ONE_ACTIVE_TARGET_INDEX} on nutrition_targets. ` +
          'It is hand-written in the nutrition migration and is lost by ' +
          '`prisma db push` or schema-only rebuilds — run `prisma migrate deploy` (or recreate it) before starting the API.',
      );
    }
    if (!isOneActiveTargetIndex(index)) {
      throw new Error(
        `Index ${NUTRITION_ONE_ACTIVE_TARGET_INDEX} must be a unique index on nutrition_targets (user_id) WHERE active = true.`,
      );
    }
  }
}

/** True only for the one-active-target index described by catalog columns. */
export function isOneActiveTargetIndex(
  index: NutritionActiveTargetIndex,
): boolean {
  return (
    index.tableName === 'nutrition_targets' &&
    index.unique === true &&
    Array.isArray(index.keyColumns) &&
    index.keyColumns.length === 1 &&
    index.keyColumns[0] === 'user_id' &&
    ACTIVE_TRUE_PREDICATES.has(normalizePredicate(index.predicate))
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
