import { describe, expect, it } from 'vitest';
import {
  applyAuthRedirect,
  splitLocalePath,
  withLocalePrefix,
} from './proxy-auth';

describe('splitLocalePath', () => {
  it('strips a supported locale prefix', () => {
    expect(splitLocalePath('/en/dashboard')).toEqual({
      locale: 'en',
      pathnameWithoutLocale: '/dashboard',
    });
  });

  it('falls back to the default locale without a prefix', () => {
    expect(splitLocalePath('/login')).toEqual({
      locale: 'uk',
      pathnameWithoutLocale: '/login',
    });
  });
});

describe('withLocalePrefix', () => {
  it('replaces an existing locale prefix', () => {
    expect(withLocalePrefix('/uk/dashboard', 'en')).toBe('/en/dashboard');
  });
});

describe('applyAuthRedirect', () => {
  it('sends an unauthenticated dashboard visit to a locale-prefixed login', () => {
    expect(
      applyAuthRedirect({
        pathnameWithoutLocale: '/dashboard',
        locale: 'en',
        fullPathname: '/en/dashboard',
        hint: null,
      }),
    ).toBe('/en/login?next=%2Fen%2Fdashboard');
  });

  it('sends a completed session away from a locale-prefixed login', () => {
    expect(
      applyAuthRedirect({
        pathnameWithoutLocale: '/login',
        locale: 'uk',
        fullPathname: '/uk/login',
        hint: 'complete',
      }),
    ).toBe('/uk/dashboard');
  });

  it('sends a completed session with a selected plan to checkout', () => {
    expect(
      applyAuthRedirect({
        pathnameWithoutLocale: '/login',
        locale: 'uk',
        fullPathname: '/uk/login',
        hint: 'complete',
        planId: 'plan-3',
      }),
    ).toBe('/uk/checkout?planId=plan-3');
  });

  it('protects checkout like other client routes', () => {
    expect(
      applyAuthRedirect({
        pathnameWithoutLocale: '/checkout',
        locale: 'en',
        fullPathname: '/en/checkout',
        hint: null,
      }),
    ).toBe('/en/login?next=%2Fen%2Fcheckout');
  });

  it('lets guests open onboarding without an account', () => {
    expect(
      applyAuthRedirect({
        pathnameWithoutLocale: '/onboarding',
        locale: 'uk',
        fullPathname: '/uk/onboarding',
        hint: null,
      }),
    ).toBeNull();
  });

  it('lets a guest reach register after the quiz even with a leftover onboarding hint', () => {
    expect(
      applyAuthRedirect({
        pathnameWithoutLocale: '/register',
        locale: 'en',
        fullPathname: '/en/register',
        hint: 'onboarding',
        planId: 'plan-3',
      }),
    ).toBeNull();
  });

  it('keeps incomplete onboarding away from checkout', () => {
    expect(
      applyAuthRedirect({
        pathnameWithoutLocale: '/checkout',
        locale: 'uk',
        fullPathname: '/uk/checkout',
        hint: 'onboarding',
      }),
    ).toBe('/uk/onboarding');
  });
});
