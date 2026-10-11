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
  // Outgoing mail is disabled until SMTP_HOST is set.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  MAIL_FROM: z.string().min(3).default('YS Fitness <no-reply@localhost>'),
  // Public web URL used in email links; defaults to the first WEB_ORIGINS entry.
  APP_URL: z.string().url().optional(),
  SEED_TRAINER_EMAIL: z.string().email().optional(),
  SEED_TRAINER_PASSWORD: z.string().min(8).optional(),
});

export type AppEnvironment = z.infer<typeof envSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): AppEnvironment {
  return envSchema.parse(values);
}
