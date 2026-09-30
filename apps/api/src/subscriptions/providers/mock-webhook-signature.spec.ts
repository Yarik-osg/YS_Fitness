import { describe, expect, it } from 'vitest';
import {
  isMockWebhookExpired,
  mockWebhookExpiresAt,
  signMockWebhook,
  verifyMockWebhook,
} from './mock-webhook-signature.js';

const secret = 'secret-at-least-32-characters-long';

describe('mock webhook signature', () => {
  it('accepts a matching HMAC', () => {
    const expiresAt = mockWebhookExpiresAt();
    const signature = signMockWebhook(secret, 'pay_1', expiresAt);

    expect(verifyMockWebhook(secret, 'pay_1', expiresAt, signature)).toBe(true);
  });

  it('rejects a forged or mismatched HMAC', () => {
    const expiresAt = mockWebhookExpiresAt();
    const signature = signMockWebhook(secret, 'pay_1', expiresAt);

    expect(verifyMockWebhook(secret, 'pay_2', expiresAt, signature)).toBe(
      false,
    );
    expect(verifyMockWebhook(secret, 'pay_1', expiresAt, 'forged')).toBe(false);
    expect(verifyMockWebhook(secret, 'pay_1', expiresAt + 1, signature)).toBe(
      false,
    );
  });

  it('treats a past expiry as expired', () => {
    expect(isMockWebhookExpired(Math.floor(Date.now() / 1000) - 1)).toBe(true);
    expect(isMockWebhookExpired(mockWebhookExpiresAt())).toBe(false);
  });
});
