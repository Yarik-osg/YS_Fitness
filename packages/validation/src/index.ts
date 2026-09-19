import { z } from 'zod';

export const clientTypeSchema = z.enum(['WEB', 'MOBILE']);

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  clientType: clientTypeSchema.default('WEB'),
  deviceName: z.string().trim().min(1).max(100).optional(),
});

export const loginSchema = registerSchema.pick({
  email: true,
  password: true,
  clientType: true,
  deviceName: true,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  clientType: clientTypeSchema.default('WEB'),
});

export const logoutSchema = refreshSchema;

export const healthRestrictionSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
});

export const onboardingSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO date format YYYY-MM-DD'),
  biologicalSexForCalculation: z.enum(['MALE', 'FEMALE']),
  heightCm: z.number().positive().min(80).max(250),
  weightKg: z.number().positive().min(25).max(500),
  bodyFatPercent: z.number().min(1).max(75).optional(),
  activityLevel: z.enum([
    'SEDENTARY',
    'LIGHTLY_ACTIVE',
    'MODERATELY_ACTIVE',
    'VERY_ACTIVE',
    'EXTRA_ACTIVE',
  ]),
  goal: z.enum(['LOSE_WEIGHT', 'MAINTAIN_WEIGHT', 'GAIN_WEIGHT']),
  healthRestrictions: z.array(healthRestrictionSchema).max(50).optional(),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
