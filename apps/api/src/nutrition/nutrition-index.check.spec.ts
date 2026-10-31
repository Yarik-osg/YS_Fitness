import { describe, expect, it, vi } from 'vitest';
import {
  NUTRITION_ONE_ACTIVE_TARGET_INDEX,
  NutritionIndexCheck,
  isOneActiveTargetIndex,
} from './nutrition-index.check.js';

function checkWith(rows: { indexdef: string }[]) {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
  return new NutritionIndexCheck(prisma as never);
}

describe('NutritionIndexCheck', () => {
  it('refuses to boot when the partial unique index is missing or not partial', async () => {
    await expect(checkWith([]).onApplicationBootstrap()).rejects.toThrow(
      `Missing partial unique index ${NUTRITION_ONE_ACTIVE_TARGET_INDEX}`,
    );
    await expect(
      checkWith([
        {
          indexdef: `CREATE UNIQUE INDEX ${NUTRITION_ONE_ACTIVE_TARGET_INDEX} ON public.nutrition_targets USING btree (user_id)`,
        },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow(NUTRITION_ONE_ACTIVE_TARGET_INDEX);
  });

  it('accepts the definition postgres reports for a boolean predicate', () => {
    expect(
      isOneActiveTargetIndex(
        `CREATE UNIQUE INDEX ${NUTRITION_ONE_ACTIVE_TARGET_INDEX} ON public.nutrition_targets USING btree (user_id) WHERE (active = true)`,
      ),
    ).toBe(true);
  });
});
