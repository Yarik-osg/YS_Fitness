import {
  grantSubscriptionSchema,
  type GrantSubscriptionInput,
} from '@repo/validation';

export class GrantSubscriptionDto implements GrantSubscriptionInput {
  static readonly schema = grantSubscriptionSchema;

  userId!: string;
  planId!: string;
  expiresAt?: string;
}
