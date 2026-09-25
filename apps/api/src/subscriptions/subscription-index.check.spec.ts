import { describe, expect, it, vi } from 'vitest';
import {
  ONE_ACTIVE_PER_USER_INDEX,
  SubscriptionIndexCheck,
} from './subscription-index.check.js';

function checkWith(rows: { indexdef: string }[]) {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
  return new SubscriptionIndexCheck(prisma as never);
}

describe('SubscriptionIndexCheck', () => {
  it('refuses to boot when the partial unique index is missing', async () => {
    await expect(checkWith([]).onApplicationBootstrap()).rejects.toThrow(
      `Missing partial unique index ${ONE_ACTIVE_PER_USER_INDEX}`,
    );
  });

  it('refuses to boot when the index is not unique or not partial on status', async () => {
    await expect(
      checkWith([
        {
          indexdef: `CREATE INDEX ${ONE_ACTIVE_PER_USER_INDEX} ON public.subscriptions USING btree (user_id)`,
        },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow('missing UNIQUE, PENDING, ACTIVE');
  });

  it('accepts the definition postgres reports for the migration', async () => {
    await expect(
      checkWith([
        {
          indexdef: `CREATE UNIQUE INDEX ${ONE_ACTIVE_PER_USER_INDEX} ON public.subscriptions USING btree (user_id) WHERE (status = ANY (ARRAY['PENDING'::"SubscriptionStatus", 'ACTIVE'::"SubscriptionStatus"]))`,
        },
      ]).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });
});
