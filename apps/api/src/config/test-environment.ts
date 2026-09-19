import { z } from 'zod';
import {
  readProcessEnvironment,
  writeProcessEnvironment,
} from './process-environment.js';

const testDatabaseSchema = z.string().url();

export function readTestDatabaseUrl(): string | undefined {
  const result = testDatabaseSchema.safeParse(
    readProcessEnvironment().TEST_DATABASE_URL,
  );
  return result.success ? result.data : undefined;
}

export function configureE2eEnvironment(databaseUrl: string): void {
  writeProcessEnvironment({
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
    CSRF_SECRET: 'test-csrf-secret-at-least-32-characters',
    WEB_ORIGINS: 'http://localhost:3000',
    COOKIE_SAME_SITE: 'none',
  });
}
