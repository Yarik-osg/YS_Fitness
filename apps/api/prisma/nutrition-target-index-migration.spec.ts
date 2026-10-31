import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);
const nutritionMigration = '20261101010000_add_nutrition_profile_and_targets';

function migrationSql(directory: string): string {
  return readFileSync(
    path.join(migrationsDir, directory, 'migration.sql'),
    'utf8',
  );
}

describe('nutrition active-target index', () => {
  it('creates one partial unique index on the active row', () => {
    const sql = migrationSql(nutritionMigration);
    expect(sql).toContain('CREATE UNIQUE INDEX "nutrition_one_active_target"');
    expect(sql).toContain('WHERE "active"');
  });

  it('does not let a later migration drop the index', () => {
    const later = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name > nutritionMigration)
      .map((entry) => entry.name);

    for (const directory of later) {
      expect(migrationSql(directory), directory).not.toMatch(
        /DROP INDEX[^;]*nutrition_one_active_target/i,
      );
    }
  });
});
