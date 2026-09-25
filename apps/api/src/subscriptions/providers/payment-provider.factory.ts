import type { FactoryProvider } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { MockPaymentProvider } from './mock-payment-provider.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './payment-provider.interface.js';

export const MOCK_PROVIDER_IN_PRODUCTION_ERROR =
  'MockPaymentProvider cannot run in production — configure a real PAYMENT_PROVIDER before deploying';

export function createPaymentProvider(
  config: AppConfigService,
): PaymentProvider {
  if (config.get('NODE_ENV') === 'production') {
    throw new Error(MOCK_PROVIDER_IN_PRODUCTION_ERROR);
  }
  return new MockPaymentProvider();
}

export const paymentProviderRegistration: FactoryProvider<PaymentProvider> = {
  provide: PAYMENT_PROVIDER,
  inject: [AppConfigService],
  useFactory: createPaymentProvider,
};
