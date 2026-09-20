export type SessionHint = 'onboarding' | 'complete';

const COOKIE_NAME = 'ys_web_session';

export function parseSessionHint(
  value: string | undefined | null,
): SessionHint | null {
  return value === 'onboarding' || value === 'complete' ? value : null;
}

export function readSessionHint(): SessionHint | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  return parseSessionHint(match?.slice(COOKIE_NAME.length + 1));
}

export function writeSessionHint(hint: SessionHint) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${hint}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export function clearSessionHint() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
