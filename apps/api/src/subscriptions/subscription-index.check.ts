import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const ONE_ACTIVE_PER_USER_INDEX = 'subscription_one_active_per_user';

@Injectable()
export class SubscriptionIndexCheck implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'subscriptions'
        AND indexname = ${ONE_ACTIVE_PER_USER_INDEX}
    `;
    const definition = rows[0]?.indexdef;

    if (!definition) {
      throw new Error(
        `Missing partial unique index ${ONE_ACTIVE_PER_USER_INDEX} on subscriptions. ` +
          'It is hand-written in the add_plans_and_subscriptions migration and is lost by ' +
          '`prisma db push` or schema-only rebuilds — run `prisma migrate deploy` (or recreate it) before starting the API.',
      );
    }

    const missing = ['UNIQUE', 'PENDING', 'ACTIVE'].filter(
      (token) => !definition.includes(token),
    );
    if (missing.length > 0) {
      throw new Error(
        `Index ${ONE_ACTIVE_PER_USER_INDEX} does not match the expected definition ` +
          `(missing ${missing.join(', ')}): ${definition}`,
      );
    }
  }
}
