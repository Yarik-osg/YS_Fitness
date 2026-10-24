import type { Prisma } from '@prisma/client';

/** Catalog sync may only deactivate system templates, including when the catalog is empty. */
export function systemTemplatesToDeactivate(
  catalogCodes: readonly string[],
): Prisma.ProgramTemplateWhereInput {
  if (catalogCodes.length === 0) return { origin: 'SYSTEM' };
  return { origin: 'SYSTEM', code: { notIn: [...catalogCodes] } };
}
