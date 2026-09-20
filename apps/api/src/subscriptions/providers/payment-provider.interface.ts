export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CheckoutResult {
  checkoutUrl: string | null;
  providerReference: string;
  immediateConfirmation: boolean;
}

export interface PaymentProvider {
  createCheckout(input: {
    subscriptionId: string;
    planIntervalMonths: number;
  }): Promise<CheckoutResult>;
}
