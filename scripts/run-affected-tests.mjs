import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const rootDirectory = dirname(
  new URL('../package.json', import.meta.url).pathname,
);
const pnpmCli = join(rootDirectory, 'node_modules/pnpm/bin/pnpm.cjs');

const hasMain =
  spawnSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main'])
    .status === 0;

const args = ['--recursive', '--if-present'];
if (hasMain) {
  args.push('--filter=...[origin/main]');
}
args.push('run', 'test');

const result = spawnSync(process.execPath, [pnpmCli, ...args], {
  cwd: rootDirectory,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
