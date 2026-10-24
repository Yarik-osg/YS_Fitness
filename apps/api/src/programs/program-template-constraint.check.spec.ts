import { describe, expect, it, vi } from 'vitest';
import {
  PROGRAM_TEMPLATE_IDENTITY_INDEX,
  PROGRAM_TEMPLATE_OWNER_CHECK,
  ProgramTemplateConstraintCheck,
} from './program-template-constraint.check.js';

function checkWith(rows: { indexdef?: string; definition?: string }[]) {
  const prisma = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce(rows.flatMap((row) => (row.indexdef ? [row] : [])))
      .mockResolvedValueOnce(
        rows.flatMap((row) => (row.definition ? [row] : [])),
      ),
  };
  return new ProgramTemplateConstraintCheck(prisma as never);
}

const indexdef = `CREATE UNIQUE INDEX ${PROGRAM_TEMPLATE_IDENTITY_INDEX} ON public.program_templates USING btree (gender, level, frequency_per_week, accent) WHERE (origin = 'SYSTEM'::"ProgramOrigin")`;
const definition = `CHECK ((((origin = 'SYSTEM'::"ProgramOrigin") AND (owner_id IS NULL)) OR ((origin = 'TRAINER'::"ProgramOrigin") AND (owner_id IS NOT NULL))))`;

describe('ProgramTemplateConstraintCheck', () => {
  it('refuses to boot when the partial unique index is missing', async () => {
    await expect(
      checkWith([{ definition }]).onApplicationBootstrap(),
    ).rejects.toThrow(
      `Missing partial unique index ${PROGRAM_TEMPLATE_IDENTITY_INDEX}`,
    );
  });

  it('refuses to boot when the index is not limited to system templates', async () => {
    await expect(
      checkWith([
        {
          indexdef: `CREATE UNIQUE INDEX ${PROGRAM_TEMPLATE_IDENTITY_INDEX} ON public.program_templates USING btree (gender, level, frequency_per_week, accent)`,
          definition,
        },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow("WHERE origin = 'SYSTEM'");
  });

  it('refuses to boot when the partial predicate excludes system templates', async () => {
    await expect(
      checkWith([
        {
          indexdef: `CREATE UNIQUE INDEX ${PROGRAM_TEMPLATE_IDENTITY_INDEX} ON public.program_templates USING btree (gender, level, frequency_per_week, accent) WHERE (origin <> 'SYSTEM'::"ProgramOrigin")`,
          definition,
        },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow("WHERE origin = 'SYSTEM'");
  });

  it('refuses to boot when the ownership check is missing', async () => {
    await expect(
      checkWith([{ indexdef }]).onApplicationBootstrap(),
    ).rejects.toThrow(
      `Missing ownership check ${PROGRAM_TEMPLATE_OWNER_CHECK}`,
    );
  });

  it('refuses to boot when the ownership check does not mention both origins', async () => {
    await expect(
      checkWith([
        {
          indexdef,
          definition: 'CHECK ((owner_id IS NULL))',
        },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow('must pair SYSTEM with a null owner');
  });

  it('refuses to boot when system and trainer owner rules are swapped', async () => {
    await expect(
      checkWith([
        {
          indexdef,
          definition: `CHECK ((((origin = 'SYSTEM'::"ProgramOrigin") AND (owner_id IS NOT NULL)) OR ((origin = 'TRAINER'::"ProgramOrigin") AND (owner_id IS NULL))))`,
        },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow('must pair SYSTEM with a null owner');
  });

  it('accepts the definitions postgres reports for the migration', async () => {
    await expect(
      checkWith([{ indexdef, definition }]).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });
});
