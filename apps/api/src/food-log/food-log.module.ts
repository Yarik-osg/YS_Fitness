import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module.js';
import { NutritionModule } from '../nutrition/nutrition.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { FoodLogController } from './food-log.controller.js';
import { FoodLogRepository } from './food-log.repository.js';
import { FoodLogService } from './food-log.service.js';

@Module({
  imports: [
    AuthModule,
    SubscriptionsModule,
    FoodCatalogModule,
    NutritionModule,
  ],
  controllers: [FoodLogController],
  providers: [FoodLogRepository, FoodLogService],
})
export class FoodLogModule {}
