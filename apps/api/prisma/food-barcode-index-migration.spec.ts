import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);
const barcodeMigration = '20261110223000_food_product_barcode';

function migrationSql(directory: string): string {
  return readFileSync(
    path.join(migrationsDir, directory, 'migration.sql'),
    'utf8',
  );
}

describe('custom food barcode index', () => {
  it('creates one partial unique index for custom barcodes', () => {
    const sql = migrationSql(barcodeMigration);
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "food_products_custom_barcode_key"',
    );
    expect(sql).toContain(
      `WHERE "source" = 'CUSTOM' AND "barcode" IS NOT NULL`,
    );
  });

  it('does not let a later migration drop the index', () => {
    const later = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name > barcodeMigration)
      .map((entry) => entry.name);

    for (const directory of later) {
      expect(migrationSql(directory), directory).not.toMatch(
        /DROP INDEX[^;]*food_products_custom_barcode_key/i,
      );
    }
  });
});
