import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);
const originMigration = '20261024114843_program_template_origin';

function migrationSql(directory: string): string {
  return readFileSync(
    path.join(migrationsDir, directory, 'migration.sql'),
    'utf8',
  );
}

describe('program template SQL constraints', () => {
  it('recreates the partial index and ownership check after dropping the full index', () => {
    const sql = migrationSql(originMigration);
    const dropAt = sql.indexOf(
      'DROP INDEX "public"."program_templates_identity_key"',
    );
    const createAt = sql.indexOf(
      'CREATE UNIQUE INDEX "program_templates_identity_key"',
    );
    const checkAt = sql.indexOf(
      'ADD CONSTRAINT "program_templates_owner_origin_check"',
    );

    expect(dropAt).toBeGreaterThanOrEqual(0);
    expect(createAt).toBeGreaterThan(dropAt);
    expect(sql.slice(createAt)).toContain('WHERE "origin" = \'SYSTEM\'');
    expect(checkAt).toBeGreaterThan(createAt);
  });

  it('does not let a later migration drop either SQL-only constraint', () => {
    const later = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name > originMigration)
      .map((entry) => entry.name);

    for (const directory of later) {
      const sql = migrationSql(directory);
      expect(sql, directory).not.toMatch(
        /DROP INDEX[^;]*program_templates_identity_key/i,
      );
      expect(sql, directory).not.toMatch(
        /DROP CONSTRAINT[^;]*program_templates_owner_origin_check/i,
      );
    }
  });
});
