import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url)),
);
const pnpmCli = join(rootDirectory, 'node_modules/pnpm/bin/pnpm.cjs');

const result = spawnSync(
  process.execPath,
  [pnpmCli, 'exec', 'turbo', 'run', 'test', '--filter=...[origin/main]'],
  {
    cwd: rootDirectory,
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
