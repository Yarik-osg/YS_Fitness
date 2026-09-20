import { describe, expect, it } from 'vitest';
import { resolvePlanCtaPath } from './plan-cta';

describe('resolvePlanCtaPath', () => {
  it('sends guests to register with the selected plan id', () => {
    expect(
      resolvePlanCtaPath({
        authenticated: false,
        onboarded: false,
        hasNonTerminalSubscription: false,
        planId: 'plan-3',
      }),
    ).toBe('/register?planId=plan-3');
  });

  it('sends authenticated users without onboarding to onboarding', () => {
    expect(
      resolvePlanCtaPath({
        authenticated: true,
        onboarded: false,
        hasNonTerminalSubscription: false,
        planId: 'plan-3',
      }),
    ).toBe('/onboarding');
  });

  it('sends onboarded users with an active subscription to the dashboard', () => {
    expect(
      resolvePlanCtaPath({
        authenticated: true,
        onboarded: true,
        hasNonTerminalSubscription: true,
        planId: 'plan-3',
      }),
    ).toBe('/dashboard');
  });

  it('sends onboarded users without a subscription to checkout', () => {
    expect(
      resolvePlanCtaPath({
        authenticated: true,
        onboarded: true,
        hasNonTerminalSubscription: false,
        planId: 'plan-3',
      }),
    ).toBe('/checkout?planId=plan-3');
  });
});
