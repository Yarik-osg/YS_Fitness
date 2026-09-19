import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const rootDirectory = dirname(
  new URL('../package.json', import.meta.url).pathname,
);
const pnpmCli = join(rootDirectory, 'node_modules/pnpm/bin/pnpm.cjs');
const git = spawnSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
  { encoding: 'utf8' },
);

if (git.status !== 0) {
  process.exit(git.status ?? 1);
}

const files = git.stdout.split('\n').filter(Boolean);
const rootAffectsAll = files.some(
  (file) =>
    !file.includes('/') ||
    file.startsWith('scripts/') ||
    file.startsWith('packages/eslint-config/') ||
    file.startsWith('packages/typescript-config/'),
);

const args = ['--recursive', '--if-present'];

if (!rootAffectsAll) {
  const filters = new Set();

  for (const file of files) {
    const match = file.match(/^(apps|packages)\/([^/]+)\//);
    if (!match) continue;

    const packageDirectory = join(match[1], match[2]);
    const packageJsonPath = join(packageDirectory, 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.name) {
      filters.add(`...${packageJson.name}`);
    }
  }

  if (filters.size === 0) {
    process.exit(0);
  }

  for (const filter of filters) {
    args.push(`--filter=${filter}`);
  }
}

args.push('run', 'check-types');

const result = spawnSync(process.execPath, [pnpmCli, ...args], {
  cwd: rootDirectory,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
