import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { applyAuthRedirect, splitLocalePath } from './lib/auth/proxy-auth';

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const intlResponse = handleI18nRouting(request);

  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const { pathname } = request.nextUrl;
  const { locale, pathnameWithoutLocale } = splitLocalePath(pathname);
  const rawHint = request.cookies.get('ys_web_session')?.value;
  const hint =
    rawHint === 'onboarding' || rawHint === 'complete' ? rawHint : null;

  const authTarget = applyAuthRedirect({
    pathnameWithoutLocale,
    locale,
    fullPathname: pathname,
    hint,
    planId: request.nextUrl.searchParams.get('planId'),
  });

  if (authTarget) {
    return NextResponse.redirect(new URL(authTarget, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
