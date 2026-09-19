import { onboardingSchema, registerSchema } from '@repo/validation';

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

  it('accepts structured onboarding restriction tags', () => {
    const result = onboardingSchema.safeParse({
      dateOfBirth: '1990-01-01',
      biologicalSexForCalculation: 'MALE',
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'MODERATELY_ACTIVE',
      goal: 'MAINTAIN_WEIGHT',
      healthRestrictions: [{ type: 'lower_back_pain' }],
      timezone: 'UTC',
    });

    expect(result.success).toBe(true);
  });
});
