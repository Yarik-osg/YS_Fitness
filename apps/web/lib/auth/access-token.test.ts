import { describe, expect, it } from 'vitest';
import { isAccessTokenFresh } from './access-token';

function tokenWithExp(expSeconds: number) {
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
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
});
