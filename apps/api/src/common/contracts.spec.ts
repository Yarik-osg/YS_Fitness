import {
  checkoutSchema,
  forgotPasswordSchema,
  grantSubscriptionSchema,
  isPlausibleDateOfBirth,
  logWorkoutSchema,
  onboardingSchema,
  registerSchema,
  resetPasswordSchema,
  workoutCalendarQuerySchema,
} from '@repo/validation';

const femaleOnboarding = {
  name: 'Olena',
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
  name: 'Andrii',
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
      name: 'Olena',
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
      name: 'Andrii',
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

  it('no longer accepts abs as a training focus for either track', () => {
    for (const base of [femaleOnboarding, maleOnboarding]) {
      const result = onboardingSchema.safeParse({
        ...base,
        focusAreas: ['abs'],
      });

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContainEqual(['focusAreas', 0]);
    }
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

  it('rejects a name that is not letters only', () => {
    expect(
      issuePaths(
        onboardingSchema.safeParse({ ...femaleOnboarding, name: 'Anna2' }),
      ),
    ).toContainEqual(['name']);
    expect(
      issuePaths(
        onboardingSchema.safeParse({ ...femaleOnboarding, name: 'A' }),
      ),
    ).toContainEqual(['name']);
  });

  it('accepts Ukrainian and English names that use an apostrophe', () => {
    expect(
      onboardingSchema.safeParse({
        ...femaleOnboarding,
        name: 'Мар\u02BCяна',
      }).success,
    ).toBe(true);
    expect(
      onboardingSchema.safeParse({
        ...femaleOnboarding,
        name: 'Мар\u2019яна',
      }).success,
    ).toBe(true);
    expect(
      onboardingSchema.safeParse({ ...maleOnboarding, name: "O'Brien" })
        .success,
    ).toBe(true);
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

  it('accepts a real date of birth within the last 120 years', () => {
    const now = new Date('2026-09-26T12:00:00.000Z');

    expect(isPlausibleDateOfBirth('2006-09-26', now)).toBe(true);
    expect(isPlausibleDateOfBirth('1906-09-26', now)).toBe(true);
    expect(isPlausibleDateOfBirth('2026-09-26', now)).toBe(true);
  });

  it('rejects a date of birth that is not a real calendar date in range', () => {
    const now = new Date('2026-09-26T12:00:00.000Z');

    expect(isPlausibleDateOfBirth('2026-09-27', now)).toBe(false);
    expect(isPlausibleDateOfBirth('1906-09-25', now)).toBe(false);
    expect(isPlausibleDateOfBirth('1890-01-01', now)).toBe(false);
    expect(isPlausibleDateOfBirth('2026-02-31', now)).toBe(false);
    expect(isPlausibleDateOfBirth('26-09-2026', now)).toBe(false);
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

  describe('workoutCalendarQuerySchema', () => {
    const from = '2026-09-28T00:00:00.000Z';

    function parse(query: Record<string, unknown>) {
      return workoutCalendarQuerySchema.safeParse(query);
    }

    function daysAfter(days: number) {
      return new Date(Date.parse(from) + days * 86_400_000).toISOString();
    }

    it('accepts a week and a 6-week grid', () => {
      expect(parse({ from, to: daysAfter(7) }).success).toBe(true);
      expect(parse({ from, to: daysAfter(42) }).success).toBe(true);
    });

    it('allows one extra day for a DST change in a 6-week grid', () => {
      expect(parse({ from, to: daysAfter(42.05) }).success).toBe(true);
      expect(parse({ from, to: daysAfter(43) }).success).toBe(true);
    });

    it('rejects a range longer than the cap', () => {
      const result = parse({ from, to: daysAfter(44) });

      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['to'] }),
      ]);
    });

    it('rejects an end that is not after the start', () => {
      expect(parse({ from, to: from }).success).toBe(false);
      expect(parse({ from, to: daysAfter(-1) }).success).toBe(false);
    });

    it('rejects missing or malformed dates', () => {
      expect(parse({ from }).success).toBe(false);
      expect(parse({ to: daysAfter(7) }).success).toBe(false);
      expect(parse({ from: '2026-09-28', to: daysAfter(7) }).success).toBe(
        false,
      );
      expect(parse({ from, to: 'tomorrow' }).success).toBe(false);
    });
  });

  describe('logWorkoutSchema set limits', () => {
    const validSet = {
      exerciseId: '44444444-4444-4444-8444-444444444444',
      order: 1,
      setNumber: 1,
      repsCompleted: 12,
      weightKg: 35.5,
    };

    function parseSet(overrides: Record<string, unknown>) {
      return logWorkoutSchema.safeParse({
        templateId: '11111111-1111-4111-8111-111111111111',
        dayNumber: 1,
        sets: [{ ...validSet, ...overrides }],
      }).success;
    }

    it('accepts the boundary values', () => {
      expect(parseSet({ setNumber: 1 })).toBe(true);
      expect(parseSet({ repsCompleted: 1 })).toBe(true);
      expect(parseSet({ repsCompleted: 999 })).toBe(true);
      expect(parseSet({ weightKg: 0.01 })).toBe(true);
      expect(parseSet({ weightKg: 999 })).toBe(true);
      expect(parseSet({ weightKg: 35.55 })).toBe(true);
      expect(parseSet({ weightKg: undefined })).toBe(true);
    });

    it('rejects values outside the limits', () => {
      expect(parseSet({ setNumber: 0 })).toBe(false);
      expect(parseSet({ setNumber: 1.5 })).toBe(false);
      expect(parseSet({ repsCompleted: 0 })).toBe(false);
      expect(parseSet({ repsCompleted: 1000 })).toBe(false);
      expect(parseSet({ repsCompleted: 10.5 })).toBe(false);
      expect(parseSet({ weightKg: 0 })).toBe(false);
      expect(parseSet({ weightKg: -5 })).toBe(false);
      expect(parseSet({ weightKg: 999.01 })).toBe(false);
      expect(parseSet({ weightKg: 35.555 })).toBe(false);
    });
  });
});

describe('password reset contracts', () => {
  const token = 't'.repeat(43);

  it('normalizes the email and accepts only known locales when asking for a link', () => {
    expect(
      forgotPasswordSchema.parse({
        email: ' Olena@Example.COM ',
        locale: 'en',
      }),
    ).toEqual({ email: 'olena@example.com', locale: 'en' });
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(
      false,
    );
    expect(
      forgotPasswordSchema.safeParse({ email: 'a@b.co', locale: 'de' }).success,
    ).toBe(false);
  });

  it('applies the registration password rule and bounds the token when resetting', () => {
    expect(
      resetPasswordSchema.safeParse({ token, password: 'long-enough' }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ token, password: 'short' }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token, password: 'x'.repeat(129) })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: 'short', password: 'long-enough' })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        token: 't'.repeat(129),
        password: 'long-enough',
      }).success,
    ).toBe(false);
  });
});
