function decodeExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const padded = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const claims = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenFresh(
  token: string | null | undefined,
  skewMs = 30_000,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const expiresAt = decodeExpiry(token);
  return expiresAt !== null && expiresAt - skewMs > now;
}
