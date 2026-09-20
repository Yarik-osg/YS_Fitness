import { Injectable } from '@nestjs/common';
import type {
  CheckoutResult,
  PaymentProvider,
} from './payment-provider.interface.js';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  createCheckout(input: {
    subscriptionId: string;
    planIntervalMonths: number;
  }): Promise<CheckoutResult> {
    void input.planIntervalMonths;
    return Promise.resolve({
      checkoutUrl: null,
      providerReference: `mock_${input.subscriptionId}`,
      immediateConfirmation: true,
    });
  }
}
