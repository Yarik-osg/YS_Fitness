import { pathToFileURL } from 'node:url';
import { BadRequestException } from '@nestjs/common';
import { NutritionService } from './nutrition.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type NutritionBackfillSummary = {
  already: number;
  updated: number;
  manual: number;
  review: number;
  skipped: number;
};

/** Local dev database only. The script writes nutrition rows. */
export function assertYsFitnessDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) throw new Error('DATABASE_URL is missing');
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('Refusing to run: database host must be localhost');
  }
  if (url.pathname !== '/ys_fitness') {
    throw new Error('Refusing to run: database must be ys_fitness');
  }
}

/**
 * Recompute every stored nutrition client with the current formula.
 * A manual target stays. A review snapshot is stored and is not activated.
 */
export async function backfillNutritionFormula(
  prisma: PrismaService,
  nutrition: NutritionService,
): Promise<NutritionBackfillSummary> {
  const [calculations, targets] = await Promise.all([
    prisma.nutritionCalculation.findMany({
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.nutritionTarget.findMany({
      where: { active: true },
      select: { userId: true },
    }),
  ]);
  const userIds = [
    ...new Set([
      ...calculations.map((row) => row.userId),
      ...targets.map((row) => row.userId),
    ]),
  ];
  const summary: NutritionBackfillSummary = {
    already: 0,
    updated: 0,
    manual: 0,
    review: 0,
    skipped: 0,
  };

  for (const userId of userIds) {
    const active = await prisma.nutritionTarget.findFirst({
      where: { userId, active: true },
      select: { source: true, calculationId: true },
    });
    let result;
    try {
      result = await nutrition.calculate(userId);
    } catch (error) {
      if (!isInvalidInput(error)) throw error;
      summary.skipped += 1;
      continue;
    }
    if (active?.source === 'MANUAL') {
      summary.manual += 1;
      continue;
    }
    if (result.status === 'REQUIRES_REVIEW') {
      summary.review += 1;
      continue;
    }
    if (active?.source === 'CALCULATED' && active.calculationId === result.id) {
      summary.already += 1;
      continue;
    }
    await nutrition.applyCalculation(userId, result.id);
    summary.updated += 1;
  }

  return summary;
}

function isInvalidInput(error: unknown) {
  if (!(error instanceof BadRequestException)) return false;
  const body = error.getResponse();
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    body.code === 'INVALID_INPUT'
  );
}

async function main() {
  assertYsFitnessDatabase(process.env.DATABASE_URL);
  const prisma = new PrismaService();
  const nutrition = new NutritionService(prisma);
  try {
    const summary = await backfillNutritionFormula(prisma, nutrition);
    console.log(
      `Already current: ${summary.already}. Updated: ${summary.updated}. Manual kept: ${summary.manual}. Review kept: ${summary.review}. Skipped: ${summary.skipped}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Nutrition backfill failed',
    );
    process.exitCode = 1;
  });
}
