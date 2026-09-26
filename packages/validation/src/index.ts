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

export const PROGRAM_TRACKS = ['female', 'male'] as const;
export const BODY_SCALE = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
] as const;
export const FEMALE_CURRENT_BODIES = BODY_SCALE;
export const MALE_CURRENT_BODIES = BODY_SCALE;
export const DESIRED_BODIES = ['0', '1', '2', '3'] as const;
export const MAIN_GOALS = [
  'lose_weight',
  'build_muscle',
  'improve_body',
  'maintain',
  'get_stronger',
] as const;
export const EXPERIENCE_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
] as const;
export const TRAINING_FREQUENCIES = ['2', '3', '4'] as const;
export const FEMALE_FOCUS_AREAS = [
  'glutes',
  'legs',
  'shoulders',
  'back',
  'arms',
  'abs',
  'full_body',
] as const;
export const MALE_FOCUS_AREAS = ['chest', ...FEMALE_FOCUS_AREAS] as const;
export const NUTRITION_CURRENT = [
  'structured',
  'balanced',
  'intuitive',
  'irregular',
  'uncontrolled',
] as const;
export const FEMALE_MEALS_PER_DAY = [
  '1-2',
  '3',
  '4',
  '5+',
  'no_schedule',
] as const;
export const MALE_MEALS_PER_DAY = ['1-2', '3', '4-5', '6+', 'varies'] as const;
export const FEMALE_EATING_HABITS = [
  'evening_overeating',
  'snacking',
  'sweet_cravings',
  'fastfood',
  'skipping_meals',
  'portions',
  'emotional',
  'none',
] as const;
export const MALE_EATING_HABITS = [
  'late_eating',
  'skipping',
  'emotional',
  'fast_food',
  'sweets',
  'overeating',
  'irregular',
  'none',
] as const;
export const PHYSIQUE_LEVELS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
] as const;

const CURRENT_BODIES = BODY_SCALE;
const FOCUS_AREAS = [...MALE_FOCUS_AREAS] as const;
const MEALS_PER_DAY = [...FEMALE_MEALS_PER_DAY, '4-5', '6+', 'varies'] as const;
const EATING_HABITS = [
  ...FEMALE_EATING_HABITS,
  'late_eating',
  'skipping',
  'fast_food',
  'sweets',
  'overeating',
  'irregular',
] as const;

export function isPlausibleDateOfBirth(
  value: string,
  now = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const oldest = new Date(
    Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate()),
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date <= now &&
    date >= oldest &&
    date.toISOString().slice(0, 10) === value
  );
}

export const HEIGHT_CM = { min: 80, max: 250 } as const;
export const WEIGHT_KG = { min: 25, max: 500 } as const;

export function isValidPersonName(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= 2 &&
    trimmed.length <= 40 &&
    /^[\p{L}]+(?:[ '\u2019\u02BC-][\p{L}]+)*$/u.test(trimmed)
  );
}

export const onboardingProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .refine(isValidPersonName, { message: 'Name must contain letters only' }),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO date format YYYY-MM-DD'),
  biologicalSexForCalculation: z.enum(['MALE', 'FEMALE']),
  heightCm: z.number().positive().min(HEIGHT_CM.min).max(HEIGHT_CM.max),
  weightKg: z.number().positive().min(WEIGHT_KG.min).max(WEIGHT_KG.max),
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

const onboardingQuestionnaireSchema = z.object({
  programTrack: z.enum(PROGRAM_TRACKS),
  currentBody: z.enum(CURRENT_BODIES),
  desiredBody: z.enum(DESIRED_BODIES),
  mainGoal: z.enum(MAIN_GOALS),
  experience: z.enum(EXPERIENCE_LEVELS),
  trainingFrequency: z.enum(TRAINING_FREQUENCIES),
  focusAreas: z.array(z.enum(FOCUS_AREAS)).min(1).max(1),
  nutritionCurrent: z.enum(NUTRITION_CURRENT),
  mealsPerDay: z.enum(MEALS_PER_DAY),
  eatingHabits: z.array(z.enum(EATING_HABITS)).min(1),
  physiqueLevel: z.enum(PHYSIQUE_LEVELS),
});

function trackVocabulary(programTrack: (typeof PROGRAM_TRACKS)[number]) {
  return programTrack === 'male'
    ? {
        currentBodies: MALE_CURRENT_BODIES,
        mealsPerDay: MALE_MEALS_PER_DAY,
        focusAreas: MALE_FOCUS_AREAS,
        eatingHabits: MALE_EATING_HABITS,
      }
    : {
        currentBodies: FEMALE_CURRENT_BODIES,
        mealsPerDay: FEMALE_MEALS_PER_DAY,
        focusAreas: FEMALE_FOCUS_AREAS,
        eatingHabits: FEMALE_EATING_HABITS,
      };
}

function addTrackIssue(
  ctx: z.RefinementCtx,
  path: (string | number)[],
  value: string,
  allowed: readonly string[],
) {
  if (allowed.includes(value)) return;
  ctx.addIssue({
    code: 'custom',
    path,
    message: 'Value is not allowed for this program track',
  });
}

export const onboardingSchema = onboardingProfileSchema
  .merge(onboardingQuestionnaireSchema)
  .superRefine((data, ctx) => {
    const allowed = trackVocabulary(data.programTrack);
    addTrackIssue(
      ctx,
      ['currentBody'],
      data.currentBody,
      allowed.currentBodies,
    );
    addTrackIssue(ctx, ['mealsPerDay'], data.mealsPerDay, allowed.mealsPerDay);
    data.focusAreas.forEach((value, index) => {
      addTrackIssue(ctx, ['focusAreas', index], value, allowed.focusAreas);
    });
    data.eatingHabits.forEach((value, index) => {
      addTrackIssue(ctx, ['eatingHabits', index], value, allowed.eatingHabits);
    });
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const checkoutSchema = z.object({
  planId: z.string().uuid(),
});

export const grantSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  expiresAt: z.iso
    .datetime()
    .refine((value) => Date.parse(value) > Date.now(), {
      message: 'expiresAt must be in the future',
    })
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type GrantSubscriptionInput = z.infer<typeof grantSubscriptionSchema>;
