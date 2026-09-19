import type { SessionHint } from './session-cookie';
import type { AppLocale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';

const AUTH_ROUTES = ['/login', '/register'];
const PROTECTED_ROUTES = ['/onboarding', '/dashboard'];

export function splitLocalePath(pathname: string): {
  locale: AppLocale;
  pathnameWithoutLocale: string;
} {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];

  if (maybeLocale && routing.locales.includes(maybeLocale as AppLocale)) {
    const rest = `/${segments.slice(2).join('/')}`;
    return {
      locale: maybeLocale as AppLocale,
      pathnameWithoutLocale:
        rest === '/' ? '/' : rest.replace(/\/+$/, '') || '/',
    };
  }

  return {
    locale: routing.defaultLocale,
    pathnameWithoutLocale: pathname,
  };
}

export function applyAuthRedirect({
  pathnameWithoutLocale,
  locale,
  fullPathname,
  hint,
}: {
  pathnameWithoutLocale: string;
  locale: AppLocale;
  fullPathname: string;
  hint: SessionHint | null;
}): string | null {
  const prefixed = (path: string) => `/${locale}${path}`;
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathnameWithoutLocale.startsWith(route),
  );
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathnameWithoutLocale.startsWith(route),
  );

  if (isAuthRoute && hint) {
    return prefixed(hint === 'complete' ? '/dashboard' : '/onboarding');
  }

  if (isProtectedRoute && !hint) {
    return `${prefixed('/login')}?next=${encodeURIComponent(fullPathname)}`;
  }

  if (pathnameWithoutLocale.startsWith('/onboarding') && hint === 'complete') {
    return prefixed('/dashboard');
  }

  if (pathnameWithoutLocale.startsWith('/dashboard') && hint === 'onboarding') {
    return prefixed('/onboarding');
  }

  return null;
}
