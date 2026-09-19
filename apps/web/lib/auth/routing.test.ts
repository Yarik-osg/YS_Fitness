import type { MeResponse } from '@repo/shared-types';
import { describe, expect, it } from 'vitest';
import { getPostAuthPath } from './routing';

function user(onboardingCompletedAt: string | null): MeResponse {
  return {
    id: 'user-1',
    email: 'client@example.com',
    role: 'CLIENT',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: onboardingCompletedAt
      ? {
          dateOfBirth: '1990-01-01T00:00:00.000Z',
          biologicalSexForCalculation: 'FEMALE',
          heightCm: 168,
          activityLevel: 'MODERATELY_ACTIVE',
          goal: 'MAINTAIN_WEIGHT',
          healthRestrictions: null,
          timezone: 'Europe/Kyiv',
          onboardingCompletedAt,
        }
      : null,
    bodyMeasurements: [],
  };
}

describe('getPostAuthPath', () => {
  it('sends a new login to onboarding', () => {
    expect(getPostAuthPath(user(null))).toBe('/onboarding');
  });

  it('sends an onboarded login to the dashboard', () => {
    expect(getPostAuthPath(user('2026-09-19T10:00:00.000Z'))).toBe(
      '/dashboard',
    );
  });
});
