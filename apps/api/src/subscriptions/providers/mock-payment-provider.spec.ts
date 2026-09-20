import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from './mock-payment-provider.js';

describe('MockPaymentProvider', () => {
  it('confirms immediately without a hosted checkout URL', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.createCheckout({
      subscriptionId: 'sub-1',
      planIntervalMonths: 3,
    });

    expect(result).toEqual({
      checkoutUrl: null,
      providerReference: 'mock_sub-1',
      immediateConfirmation: true,
    });
  });
});
