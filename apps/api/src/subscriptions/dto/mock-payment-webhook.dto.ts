import {
  mockPaymentWebhookSchema,
  type MockPaymentWebhookInput,
} from '@repo/validation';

export class MockPaymentWebhookDto implements MockPaymentWebhookInput {
  static readonly schema = mockPaymentWebhookSchema;

  providerReference!: string;
  expiresAt!: number;
  signature!: string;
}
