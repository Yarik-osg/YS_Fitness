import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devDatabaseUrl, e2eDatabaseError } from './e2e-database.mjs';

const rootDirectory = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url)),
);

const message = e2eDatabaseError(
  process.env.TEST_DATABASE_URL,
  devDatabaseUrl(),
);
if (message) {
  process.stderr.write(message);
  process.exit(1);
}

process.stderr.write(
  'API e2e uses TEST_DATABASE_URL. The schema must already be migrated.\n',
);

const result = spawnSync(
  process.execPath,
  [join(rootDirectory, 'scripts/run-turbo.mjs'), 'run', 'test:e2e'],
  { cwd: rootDirectory, stdio: 'inherit' },
);

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
