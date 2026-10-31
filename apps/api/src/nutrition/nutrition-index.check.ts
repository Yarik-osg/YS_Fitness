import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const NUTRITION_ONE_ACTIVE_TARGET_INDEX = 'nutrition_one_active_target';

@Injectable()
export class NutritionIndexCheck implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'nutrition_targets'
        AND indexname = ${NUTRITION_ONE_ACTIVE_TARGET_INDEX}
    `;
    const definition = rows[0]?.indexdef;
    if (!definition || !isOneActiveTargetIndex(definition)) {
      throw new Error(
        `Missing partial unique index ${NUTRITION_ONE_ACTIVE_TARGET_INDEX} on nutrition_targets. ` +
          'It is hand-written in the nutrition migration and is lost by ' +
          '`prisma db push` or schema-only rebuilds — run `prisma migrate deploy` (or recreate it) before starting the API.',
      );
    }
  }
}

/** True for a unique index on user_id limited to the active row. */
export function isOneActiveTargetIndex(indexdef: string): boolean {
  const normalized = indexdef.replace(/\s+/g, ' ');
  return (
    normalized.includes('UNIQUE') &&
    /\buser_id\b/i.test(normalized) &&
    /WHERE/i.test(normalized) &&
    /\bactive\b/i.test(normalized)
  );
}
