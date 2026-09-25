import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppConfigService } from '../../config/app-config.service.js';
import { MockPaymentProvider } from './mock-payment-provider.js';
import {
  createPaymentProvider,
  MOCK_PROVIDER_IN_PRODUCTION_ERROR,
  paymentProviderRegistration,
} from './payment-provider.factory.js';
import { PAYMENT_PROVIDER } from './payment-provider.interface.js';

function configFor(nodeEnv: 'development' | 'test' | 'production') {
  return { get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined) };
}

function compileWith(nodeEnv: 'development' | 'test' | 'production') {
  return Test.createTestingModule({
    providers: [
      { provide: AppConfigService, useValue: configFor(nodeEnv) },
      paymentProviderRegistration,
    ],
  }).compile();
}

describe('createPaymentProvider', () => {
  it('refuses the mock provider in production', () => {
    expect(() =>
      createPaymentProvider(configFor('production') as never),
    ).toThrow(MOCK_PROVIDER_IN_PRODUCTION_ERROR);
  });

  it.each(['development', 'test'] as const)(
    'returns the mock provider in %s',
    (nodeEnv) => {
      expect(createPaymentProvider(configFor(nodeEnv) as never)).toBeInstanceOf(
        MockPaymentProvider,
      );
    },
  );

  it('fails module bootstrap in production', async () => {
    await expect(compileWith('production')).rejects.toThrow(
      MOCK_PROVIDER_IN_PRODUCTION_ERROR,
    );
  });

  it.each(['development', 'test'] as const)(
    'resolves PAYMENT_PROVIDER to the mock in %s',
    async (nodeEnv) => {
      const moduleRef = await compileWith(nodeEnv);
      expect(moduleRef.get(PAYMENT_PROVIDER)).toBeInstanceOf(
        MockPaymentProvider,
      );
    },
  );
});
