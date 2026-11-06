import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  FoodProductResponse,
  FoodSearchResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import {
  CreateFoodProductDto,
  FoodSearchQueryDto,
} from './dto/food-catalog.dto.js';
import {
  FOOD_SEARCH_ROUTE_LIMIT,
  FOOD_SEARCH_ROUTE_TTL_MS,
} from './food-search-limits.js';
import { FoodCatalogService } from './food-catalog.service.js';

@ApiTags('food')
@ApiBearerAuth()
@Controller('food')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class FoodCatalogController {
  constructor(private readonly catalog: FoodCatalogService) {}

  @Get('products/search')
  @Throttle({
    default: {
      limit: FOOD_SEARCH_ROUTE_LIMIT,
      ttl: FOOD_SEARCH_ROUTE_TTL_MS,
    },
  })
  @ApiOperation({
    summary:
      'Search the caller’s foods, then the local cache, then Open Food Facts',
  })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FoodSearchQueryDto,
  ): Promise<FoodSearchResponse> {
    return this.catalog.search(user.sub, query);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom food from per-100g values' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFoodProductDto,
  ): Promise<FoodProductResponse> {
    return this.catalog.create(user.sub, body);
  }
}
