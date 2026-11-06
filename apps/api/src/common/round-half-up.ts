import { Prisma } from '@prisma/client';

export function roundHalfUp(
  value: Prisma.Decimal.Value,
  decimals: number,
): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(
    decimals,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}
