import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  databaseName,
  devDatabaseUrl,
  e2eDatabaseError,
} from './e2e-database.mjs';

const dev = 'postgresql://localhost:5432/ys_fitness';
const testDb = 'postgresql://localhost:5432/ys_fitness_test?schema=public';

test('requires a URL with a database name', () => {
  assert.match(e2eDatabaseError(''), /TEST_DATABASE_URL/);
  assert.match(e2eDatabaseError('ys_fitness'), /database name/);
  assert.equal(databaseName(testDb), 'ys_fitness_test');
});

test('refuses the dev database and allows a different name', () => {
  assert.match(e2eDatabaseError(dev, dev), /ys_fitness/);
  assert.match(
    e2eDatabaseError(
      'postgresql://other:secret@db.internal:5432/ys_fitness',
      dev,
    ),
    /ys_fitness/,
  );
  assert.equal(e2eDatabaseError(testDb, dev), '');
});

test('reads the dev database name from apps/api/.env', () => {
  const root = mkdtempSync(join(tmpdir(), 'e2e-db-'));
  try {
    mkdirSync(join(root, 'apps/api'), { recursive: true });
    writeFileSync(
      join(root, 'apps/api/.env'),
      '# local\nDATABASE_URL="postgresql://localhost:5432/ys_fitness"\n',
    );
    const stored = devDatabaseUrl(root);
    assert.equal(e2eDatabaseError(dev, stored), e2eDatabaseError(dev, dev));
    assert.equal(e2eDatabaseError(testDb, stored), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
