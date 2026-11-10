import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { FoodCatalogRepository } from './food-catalog.repository.js';
import { FoodCatalogService } from './food-catalog.service.js';
import { OFF_BARCODE_BUDGET_PER_MIN } from './food-search-limits.js';
import {
  CLOCK,
  OffOutboundLimiter,
  SystemClock,
  type Clock,
} from './off-limiter.js';
import {
  OFF_CLIENT,
  OpenFoodFactsHttp,
  RateLimitedOffClient,
} from './off-client.js';

@Module({
  providers: [
    FoodCatalogRepository,
    FoodCatalogService,
    OpenFoodFactsHttp,
    SystemClock,
    { provide: CLOCK, useExisting: SystemClock },
    {
      provide: OffOutboundLimiter,
      useFactory: (clock: Clock, config: AppConfigService) =>
        new OffOutboundLimiter(clock, {
          searchPerMin: config.get('OFF_SEARCH_BUDGET_PER_MIN'),
          userPerMin: config.get('FOOD_SEARCH_USER_OFF_CALLS_PER_MIN'),
          barcodePerMin: OFF_BARCODE_BUDGET_PER_MIN,
          barcodeUserPerMin: config.get('FOOD_BARCODE_USER_OFF_CALLS_PER_MIN'),
        }),
      inject: [CLOCK, AppConfigService],
    },
    { provide: OFF_CLIENT, useClass: RateLimitedOffClient },
  ],
  exports: [FoodCatalogService, OffOutboundLimiter, OpenFoodFactsHttp],
})
export class FoodCatalogModule {}
