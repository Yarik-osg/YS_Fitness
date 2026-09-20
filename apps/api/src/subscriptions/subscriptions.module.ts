import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SubscriptionGuard } from './subscription.guard.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { MockPaymentProvider } from './providers/mock-payment-provider.js';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface.js';

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsRepository,
    SubscriptionsService,
    SubscriptionGuard,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [SubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
