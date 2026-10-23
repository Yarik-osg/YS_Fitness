import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDirectory = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url)),
);

export function dotenvValue(text, key) {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1 || trimmed.slice(0, separator).trim() !== key) {
      continue;
    }
    let value = trimmed.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    return value;
  }
  return '';
}

export function databaseName(value) {
  try {
    return decodeURIComponent(
      new URL(value).pathname.replace(/^\/+|\/+$/g, ''),
    );
  } catch {
    return '';
  }
}

// The dev database is apps/api/.env. CI does not have that file, and its
// DATABASE_URL is already the test database.
export function devDatabaseUrl(root = rootDirectory) {
  const path = join(root, 'apps/api/.env');
  if (!existsSync(path)) return '';
  return dotenvValue(readFileSync(path, 'utf8'), 'DATABASE_URL');
}

export function e2eDatabaseError(testUrl, devUrl = '') {
  if (!testUrl?.trim()) {
    return (
      'pnpm test:e2e needs TEST_DATABASE_URL set to a migrated database URL.\n' +
      'Apply migrations first:\n' +
      '  DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter api exec prisma migrate deploy\n'
    );
  }

  const name = databaseName(testUrl.trim());
  if (!name) {
    return 'TEST_DATABASE_URL must be a URL that includes a database name.\n';
  }

  const devName = devUrl ? databaseName(devUrl) : '';
  if (devName && devName === name) {
    return `TEST_DATABASE_URL uses the dev database "${name}" from apps/api/.env. Use a different database.\n`;
  }

  return '';
}

function main() {
  const message = e2eDatabaseError(
    process.env.TEST_DATABASE_URL,
    devDatabaseUrl(),
  );
  if (message) {
    process.stderr.write(message);
    process.exit(1);
  }
}

const invoked = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';

if (import.meta.url === invoked) main();
