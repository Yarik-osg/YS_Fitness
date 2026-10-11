const COOKIE_NAME = 'ys_csrf';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  const value = match?.slice(COOKIE_NAME.length + 1);
  return value ? decodeURIComponent(value) : undefined;
}

export function writeCsrfToken(token: string) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearCsrfToken() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
