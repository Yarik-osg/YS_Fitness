import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readProcessEnvironment } from '../src/config/process-environment.js';

const execFileAsync = promisify(execFile);

const apiRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export async function setup(): Promise<void> {
  const env = readProcessEnvironment();
  const databaseUrl = env.TEST_DATABASE_URL;
  if (!databaseUrl) return;

  await execFileAsync('pnpm', ['exec', 'prisma', 'db', 'seed'], {
    cwd: apiRoot,
    env: {
      ...env,
      DATABASE_URL: databaseUrl,
      SEED_TRAINER_EMAIL: env.SEED_TRAINER_EMAIL ?? 'trainer@example.com',
      SEED_TRAINER_PASSWORD:
        env.SEED_TRAINER_PASSWORD ?? 'e2e-trainer-password',
    },
  });
}
