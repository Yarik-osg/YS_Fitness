import { describe, expect, it } from 'vitest';
import { isAccessTokenFresh } from './access-token';

function tokenWithExp(expSeconds: number) {
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `header.${payload}.signature`;
}

function unpaddedToken(claims: Record<string, unknown>) {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

describe('isAccessTokenFresh', () => {
  const now = 1_700_000_000_000;

  it('is true when exp is more than the skew away', () => {
    expect(isAccessTokenFresh(tokenWithExp(1_700_000_060), 30_000, now)).toBe(
      true,
    );
  });

  it('is false when exp is inside the skew window', () => {
    expect(isAccessTokenFresh(tokenWithExp(1_700_000_020), 30_000, now)).toBe(
      false,
    );
  });

  it('is false for a missing or malformed token', () => {
    expect(isAccessTokenFresh(null)).toBe(false);
    expect(isAccessTokenFresh('not-a-jwt')).toBe(false);
  });

  it('reads an unpadded TRAINER-shaped payload', () => {
    const token = unpaddedToken({
      sub: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      role: 'TRAINER',
      iat: 1_700_000_000,
      exp: 1_700_000_060,
    });

    expect(token.split('.')[1]?.length ?? 0).not.toBe(0);
    expect((token.split('.')[1]?.length ?? 0) % 4).not.toBe(0);
    expect(isAccessTokenFresh(token, 30_000, now)).toBe(true);
  });
});
