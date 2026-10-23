import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDirectory = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url)),
);

// shortcut: this does not fetch, so a local origin/main can be behind the remote; a missing base runs every test.
export function resolveAffectedBase(run) {
  const head = run(['rev-parse', 'HEAD']);
  if (head.status !== 0) return null;
  const headSha = head.stdout.trim();

  for (const ref of ['origin/main', 'main']) {
    const verified = run([
      'rev-parse',
      '--verify',
      '--quiet',
      `${ref}^{commit}`,
    ]);
    if (verified.status !== 0) continue;
    // A ref that is HEAD is the branch itself. Filtering against it selects nothing.
    if (verified.stdout.trim() === headSha) continue;
    const base = run(['merge-base', 'HEAD', ref]);
    if (base.status !== 0 || !base.stdout.trim()) continue;
    return ref;
  }

  return null;
}

function git(args) {
  return spawnSync('git', args, {
    cwd: rootDirectory,
    encoding: 'utf8',
  });
}

function runTests(filter) {
  const args = [join(rootDirectory, 'scripts/run-turbo.mjs'), 'run', 'test'];
  if (filter) args.push(`--filter=...[${filter}]`);
  return spawnSync(process.execPath, args, {
    cwd: rootDirectory,
    stdio: 'inherit',
  });
}

function main() {
  const ref = resolveAffectedBase(git);
  if (!ref) {
    process.stderr.write(
      'No merge base with origin/main or main. Running the full test suite.\n',
    );
    process.exit(runTests(null).status ?? 1);
  }

  process.exit(runTests(ref).status ?? 1);
}

const invoked = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';

if (import.meta.url === invoked) main();
