import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const PROGRAM_TEMPLATE_IDENTITY_INDEX = 'program_templates_identity_key';
export const PROGRAM_TEMPLATE_OWNER_CHECK =
  'program_templates_owner_origin_check';

@Injectable()
export class ProgramTemplateConstraintCheck implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const [indexes, checks] = await Promise.all([
      this.prisma.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'program_templates'
          AND indexname = ${PROGRAM_TEMPLATE_IDENTITY_INDEX}
      `,
      this.prisma.$queryRaw<{ definition: string }[]>`
        SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname = ${PROGRAM_TEMPLATE_OWNER_CHECK}
          AND contype = 'c'
      `,
    ]);

    const indexdef = indexes[0]?.indexdef;
    if (!indexdef) {
      throw new Error(
        `Missing partial unique index ${PROGRAM_TEMPLATE_IDENTITY_INDEX} on program_templates. ` +
          'It is hand-written in the program_template_origin migration and is lost by ' +
          '`prisma db push` or schema-only rebuilds — run `prisma migrate deploy` (or recreate it) before starting the API.',
      );
    }
    if (!isSystemIdentityIndex(indexdef)) {
      throw new Error(
        `Index ${PROGRAM_TEMPLATE_IDENTITY_INDEX} must be a unique partial index ` +
          `WHERE origin = 'SYSTEM': ${indexdef}`,
      );
    }

    const definition = checks[0]?.definition;
    if (!definition) {
      throw new Error(
        `Missing ownership check ${PROGRAM_TEMPLATE_OWNER_CHECK} on program_templates. ` +
          'It is hand-written in the program_template_origin migration and is lost by ' +
          '`prisma db push` or schema-only rebuilds — run `prisma migrate deploy` (or recreate it) before starting the API.',
      );
    }
    if (!isOwnershipCheck(definition)) {
      throw new Error(
        `Check ${PROGRAM_TEMPLATE_OWNER_CHECK} must pair SYSTEM with a null owner ` +
          `and TRAINER with an owner: ${definition}`,
      );
    }
  }
}

/** True only for a unique index whose predicate assigns origin to SYSTEM. */
export function isSystemIdentityIndex(indexdef: string): boolean {
  const normalized = indexdef.replace(/\s+/g, ' ');
  return (
    normalized.includes('UNIQUE') &&
    normalized.includes('WHERE') &&
    /origin\s*=\s*'SYSTEM'/i.test(normalized)
  );
}

/**
 * True when one OR-branch is SYSTEM with a null owner and another is TRAINER
 * with an owner. A swapped pairing does not match.
 */
export function isOwnershipCheck(definition: string): boolean {
  const flat = definition.replace(/[()]/g, ' ').replace(/\s+/g, ' ');
  const parts = flat.split(/\s+OR\s+/i);
  const systemNull = parts.some(
    (part) =>
      /origin\s*=\s*'SYSTEM'/i.test(part) &&
      /owner_id\s+IS\s+NULL/i.test(part) &&
      !/IS\s+NOT\s+NULL/i.test(part),
  );
  const trainerOwned = parts.some(
    (part) =>
      /origin\s*=\s*'TRAINER'/i.test(part) &&
      /owner_id\s+IS\s+NOT\s+NULL/i.test(part),
  );
  return systemNull && trainerOwned;
}
