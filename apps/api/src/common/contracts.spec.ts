import {
  checkoutSchema,
  grantSubscriptionSchema,
  onboardingSchema,
  registerSchema,
} from '@repo/validation';

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
        expiresAt: '2026-12-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});
