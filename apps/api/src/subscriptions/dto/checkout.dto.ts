import { checkoutSchema, type CheckoutInput } from '@repo/validation';

export class CheckoutDto implements CheckoutInput {
  static readonly schema = checkoutSchema;

  planId!: string;
}
