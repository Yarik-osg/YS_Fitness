import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { FoodCatalogController } from './food-catalog.controller.js';
import { FoodCatalogRepository } from './food-catalog.repository.js';
import { FoodCatalogService } from './food-catalog.service.js';
import { OFF_CLIENT, OpenFoodFactsClient } from './off-client.js';

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [FoodCatalogController],
  providers: [
    FoodCatalogRepository,
    FoodCatalogService,
    { provide: OFF_CLIENT, useClass: OpenFoodFactsClient },
  ],
  exports: [FoodCatalogService],
})
export class FoodCatalogModule {}
