import type { MeResponse } from '@repo/shared-types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPostAuthPath,
  getPostRegisterPath,
  resolveIncompleteGuestDestination,
} from './routing';

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
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  it('sends a new login to onboarding', () => {
    expect(getPostAuthPath(user(null))).toBe('/onboarding');
  });

  it('sends an onboarded login to the dashboard', () => {
    expect(getPostAuthPath(user('2026-09-19T10:00:00.000Z'), null)).toBe(
      '/dashboard',
    );
  });

  it('sends an onboarded login with a selected plan to checkout', () => {
    expect(getPostAuthPath(user('2026-09-19T10:00:00.000Z'), 'plan-3')).toBe(
      '/checkout?planId=plan-3',
    );
  });
});

describe('resolveIncompleteGuestDestination', () => {
  it('keeps Get Access on register so the quiz is not shown again', () => {
    expect(resolveIncompleteGuestDestination('/register')).toBeNull();
  });

  it('still sends an incomplete login to onboarding', () => {
    expect(resolveIncompleteGuestDestination('/login')).toBe('/onboarding');
  });
});

describe('getPostRegisterPath', () => {
  it('sends a new account to checkout so they can choose a plan', () => {
    expect(getPostRegisterPath(null)).toBe('/checkout');
  });

  it('keeps a preselected plan on the checkout query', () => {
    expect(getPostRegisterPath('plan-3')).toBe('/checkout?planId=plan-3');
  });
});
