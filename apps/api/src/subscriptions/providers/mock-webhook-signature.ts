import { createHmac, timingSafeEqual } from 'node:crypto';

export const MOCK_WEBHOOK_TTL_SECONDS = 30 * 60;

export function mockWebhookExpiresAt(now = Date.now()): number {
  return Math.floor(now / 1000) + MOCK_WEBHOOK_TTL_SECONDS;
}

export function signMockWebhook(
  secret: string,
  providerReference: string,
  expiresAt: number,
): string {
  return createHmac('sha256', secret)
    .update(`${providerReference}.${expiresAt}`)
    .digest('base64url');
}

export function verifyMockWebhook(
  secret: string,
  providerReference: string,
  expiresAt: number,
  signature: string,
): boolean {
  const expected = Buffer.from(
    signMockWebhook(secret, providerReference, expiresAt),
    'utf8',
  );
  const actual = Buffer.from(signature, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isMockWebhookExpired(
  expiresAt: number,
  now = Date.now(),
): boolean {
  return expiresAt * 1000 <= now;
}
