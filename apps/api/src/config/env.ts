import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  WEB_ORIGINS: z.string().default('http://localhost:3000'),
  REFRESH_COOKIE_NAME: z.string().min(1).default('ys_refresh'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  CSRF_SECRET: z.string().min(32),
  SEED_TRAINER_EMAIL: z.string().email().optional(),
  SEED_TRAINER_PASSWORD: z.string().min(8).optional(),
});

export type AppEnvironment = z.infer<typeof envSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): AppEnvironment {
  return envSchema.parse(values);
}
