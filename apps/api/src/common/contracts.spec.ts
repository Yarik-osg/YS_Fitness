import {
  checkoutSchema,
  grantSubscriptionSchema,
  onboardingSchema,
  registerSchema,
} from '@repo/validation';

const femaleOnboarding = {
  dateOfBirth: '1990-01-01',
  biologicalSexForCalculation: 'FEMALE',
  heightCm: 168,
  weightKg: 64.5,
  activityLevel: 'MODERATELY_ACTIVE',
  goal: 'MAINTAIN_WEIGHT',
  timezone: 'UTC',
  programTrack: 'female',
  currentBody: '0',
  desiredBody: '1',
  mainGoal: 'get_stronger',
  experience: 'intermediate',
  trainingFrequency: '3',
  focusAreas: ['glutes'],
  nutritionCurrent: 'balanced',
  mealsPerDay: '3',
  eatingHabits: ['snacking', 'emotional'],
  physiqueLevel: '4',
} as const;

const maleOnboarding = {
  dateOfBirth: '1990-01-15',
  biologicalSexForCalculation: 'MALE',
  heightCm: 180,
  weightKg: 82,
  activityLevel: 'LIGHTLY_ACTIVE',
  goal: 'GAIN_WEIGHT',
  timezone: 'Europe/Kyiv',
  programTrack: 'male',
  currentBody: '2',
  desiredBody: '3',
  mainGoal: 'build_muscle',
  experience: 'advanced',
  trainingFrequency: '4',
  focusAreas: ['chest'],
  nutritionCurrent: 'structured',
  mealsPerDay: '4-5',
  eatingHabits: ['late_eating', 'none'],
  physiqueLevel: '6',
} as const;

function issuePaths(result: ReturnType<typeof onboardingSchema.safeParse>) {
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

describe('shared API contracts', () => {
  it('normalizes email and enforces the password minimum', () => {
    expect(
      registerSchema.parse({
        email: ' Client@Example.COM ',
        password: '12345678',
      }).email,
    ).toBe('client@example.com');

    expect(
      registerSchema.safeParse({
        email: 'client@example.com',
        password: 'short',
      }).success,
    ).toBe(false);
  });

  it('accepts a full female onboarding payload', () => {
    const result = onboardingSchema.safeParse({
      dateOfBirth: '1990-01-01',
      biologicalSexForCalculation: 'FEMALE',
      heightCm: 168,
      weightKg: 64.5,
      activityLevel: 'MODERATELY_ACTIVE',
      goal: 'MAINTAIN_WEIGHT',
      healthRestrictions: [{ type: 'lower_back_pain' }],
      timezone: 'UTC',
      programTrack: 'female',
      currentBody: '0',
      desiredBody: '1',
      mainGoal: 'get_stronger',
      experience: 'intermediate',
      trainingFrequency: '3',
      focusAreas: ['glutes'],
      nutritionCurrent: 'balanced',
      mealsPerDay: '3',
      eatingHabits: ['snacking', 'emotional'],
      physiqueLevel: '4',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a full male onboarding payload', () => {
    const result = onboardingSchema.safeParse({
      dateOfBirth: '1990-01-15',
      biologicalSexForCalculation: 'MALE',
      heightCm: 180,
      weightKg: 82,
      activityLevel: 'LIGHTLY_ACTIVE',
      goal: 'GAIN_WEIGHT',
      timezone: 'Europe/Kyiv',
      programTrack: 'male',
      currentBody: '2',
      desiredBody: '3',
      mainGoal: 'build_muscle',
      experience: 'advanced',
      trainingFrequency: '4',
      focusAreas: ['chest'],
      nutritionCurrent: 'structured',
      mealsPerDay: '4-5',
      eatingHabits: ['late_eating', 'none'],
      physiqueLevel: '6',
    });

    expect(result.success).toBe(true);
  });

  it('rejects meals that belong to the other program track', () => {
    const meals = onboardingSchema.safeParse({
      ...femaleOnboarding,
      mealsPerDay: '4-5',
    });

    expect(issuePaths(meals)).toContainEqual(['mealsPerDay']);
  });

  it('rejects each foreign focusAreas and eatingHabits item for the track', () => {
    const chestOnFemale = onboardingSchema.safeParse({
      ...femaleOnboarding,
      focusAreas: ['chest'],
    });
    const snackingOnMale = onboardingSchema.safeParse({
      ...maleOnboarding,
      eatingHabits: ['snacking'],
    });
    const mixedFocus = onboardingSchema.safeParse({
      ...femaleOnboarding,
      focusAreas: ['glutes', 'chest', 'legs'],
    });

    expect(issuePaths(chestOnFemale)).toContainEqual(['focusAreas', 0]);
    expect(issuePaths(snackingOnMale)).toContainEqual(['eatingHabits', 0]);
    expect(issuePaths(mixedFocus)).toEqual([['focusAreas'], ['focusAreas', 1]]);
  });

  it('accepts physiqueLevel 0-9 and rejects values outside that scale', () => {
    expect(
      onboardingSchema.safeParse({ ...femaleOnboarding, physiqueLevel: '0' })
        .success,
    ).toBe(true);
    expect(
      onboardingSchema.safeParse({ ...femaleOnboarding, physiqueLevel: '9' })
        .success,
    ).toBe(true);
    expect(
      issuePaths(
        onboardingSchema.safeParse({
          ...femaleOnboarding,
          physiqueLevel: '10',
        }),
      ),
    ).toContainEqual(['physiqueLevel']);
    expect(
      issuePaths(
        onboardingSchema.safeParse({
          ...femaleOnboarding,
          physiqueLevel: '-1',
        }),
      ),
    ).toContainEqual(['physiqueLevel']);
  });

  it('requires uuid plan and user identifiers for subscription writes', () => {
    expect(
      checkoutSchema.safeParse({
        planId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
    expect(checkoutSchema.safeParse({ planId: 'not-a-uuid' }).success).toBe(
      false,
    );
    expect(
      grantSubscriptionSchema.safeParse({
        userId: '11111111-1111-4111-8111-111111111111',
        planId: '22222222-2222-4222-8222-222222222222',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      }).success,
    ).toBe(true);
  });

  it('rejects a grant expiresAt that is not in the future', () => {
    const result = grantSubscriptionSchema.safeParse({
      userId: '11111111-1111-4111-8111-111111111111',
      planId: '22222222-2222-4222-8222-222222222222',
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['expiresAt'],
        message: 'expiresAt must be in the future',
      }),
    ]);
  });
});
