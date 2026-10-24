import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { readProcessEnvironment } from './process-environment.js';

export const ownerAccountRole = UserRole.ADMIN;

const seedEnvironmentSchema = z.object({
  SEED_TRAINER_EMAIL: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  SEED_TRAINER_PASSWORD: z.string().min(8),
});

export function readSeedEnvironment() {
  return seedEnvironmentSchema.parse(readProcessEnvironment());
}
