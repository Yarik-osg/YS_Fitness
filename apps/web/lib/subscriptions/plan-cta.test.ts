import { describe, expect, it } from 'vitest';
import { resolvePlanCtaPath, resolvePostQuizAccessHref } from './plan-cta';

describe('resolvePlanCtaPath', () => {
  it('sends guests to onboarding before account creation', () => {
    expect(
      resolvePlanCtaPath({
        authenticated: false,
        onboarded: false,
        hasNonTerminalSubscription: false,
        planId: 'plan-3',
      }),
    ).toBe('/onboarding');
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

  it('keeps a third plan id intact through guest and checkout paths', () => {
    expect(
      resolvePlanCtaPath({
        authenticated: false,
        onboarded: false,
        hasNonTerminalSubscription: false,
        planId: 'plan-full',
      }),
    ).toBe('/onboarding');
    expect(
      resolvePlanCtaPath({
        authenticated: true,
        onboarded: true,
        hasNonTerminalSubscription: false,
        planId: 'plan-full',
      }),
    ).toBe('/checkout?planId=plan-full');
  });
});

describe('resolvePostQuizAccessHref', () => {
  it('sends a guest to register after the recommended program', () => {
    expect(
      resolvePostQuizAccessHref({ authenticated: false, planId: null }),
    ).toEqual({ pathname: '/register' });
  });

  it('keeps the selected plan on the register query for guests', () => {
    expect(
      resolvePostQuizAccessHref({
        authenticated: false,
        planId: 'plan-3',
      }),
    ).toEqual({ pathname: '/register', query: { planId: 'plan-3' } });
  });

  it('sends an authenticated user to checkout when a plan is selected', () => {
    expect(
      resolvePostQuizAccessHref({
        authenticated: true,
        planId: 'plan-3',
      }),
    ).toEqual({ pathname: '/checkout', query: { planId: 'plan-3' } });
  });

  it('sends an authenticated user to the dashboard without a selected plan', () => {
    expect(
      resolvePostQuizAccessHref({ authenticated: true, planId: null }),
    ).toEqual({ pathname: '/dashboard' });
  });
});
