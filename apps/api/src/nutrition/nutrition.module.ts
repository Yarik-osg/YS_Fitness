import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { NutritionIndexCheck } from './nutrition-index.check.js';
import { NutritionController } from './nutrition.controller.js';
import { NutritionService } from './nutrition.service.js';

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [NutritionController],
  providers: [NutritionService, NutritionIndexCheck],
  exports: [NutritionService],
})
export class NutritionModule {}
