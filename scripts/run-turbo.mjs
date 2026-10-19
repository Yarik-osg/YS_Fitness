import { spawnSync } from 'node:child_process';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url)),
);
const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
const localBin = join(rootDirectory, 'node_modules', '.bin');

// pnpm prepends a relative ./node_modules/.bin. Turbo resolves pnpm from
// that entry, then runs it with the package directory as cwd, so the
// relative path no longer exists.
const pathValue = (process.env[pathKey] ?? '')
  .split(delimiter)
  .map((entry) =>
    entry === './node_modules/.bin' || entry === 'node_modules/.bin'
      ? localBin
      : entry,
  )
  .join(delimiter);

const result = spawnSync(join(localBin, 'turbo'), process.argv.slice(2), {
  cwd: rootDirectory,
  stdio: 'inherit',
  env: { ...process.env, [pathKey]: pathValue },
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
