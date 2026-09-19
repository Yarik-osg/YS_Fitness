import { NextRequest, NextResponse } from 'next/server';

const AUTH_ROUTES = ['/login', '/register'];
const PROTECTED_ROUTES = ['/onboarding', '/dashboard'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawHint = request.cookies.get('ys_web_session')?.value;
  const hint =
    rawHint === 'onboarding' || rawHint === 'complete' ? rawHint : null;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (isAuthRoute && hint) {
    return NextResponse.redirect(
      new URL(hint === 'complete' ? '/dashboard' : '/onboarding', request.url),
    );
  }

  if (isProtectedRoute && !hint) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/onboarding') && hint === 'complete') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/dashboard') && hint === 'onboarding') {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/register', '/onboarding/:path*', '/dashboard/:path*'],
};
