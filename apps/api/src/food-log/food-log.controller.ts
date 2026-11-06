import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  FoodDayResponse,
  FoodLogEntryResponse,
  FoodProductListResponse,
  FoodProductResponse,
  FoodRecentResponse,
  FoodSearchResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import {
  CreateFoodProductDto,
  FoodSearchQueryDto,
} from '../food-catalog/dto/food-catalog.dto.js';
import {
  FOOD_SEARCH_ROUTE_LIMIT,
  FOOD_SEARCH_ROUTE_TTL_MS,
} from '../food-catalog/food-search-limits.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import {
  CreateFoodLogDto,
  FoodLogParamsDto,
  FoodLogQueryDto,
  FoodProductParamsDto,
  FoodRecentQueryDto,
  PatchFoodLogDto,
} from './dto/food-log.dto.js';
import { FoodLogService } from './food-log.service.js';

@ApiTags('food')
@ApiBearerAuth()
@Controller('food')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class FoodLogController {
  constructor(private readonly log: FoodLogService) {}

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
    return this.log.searchFoods(user.sub, query);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom food from per-100g values' })
  createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFoodProductDto,
  ): Promise<FoodProductResponse> {
    return this.log.createProduct(user.sub, body);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List favorite foods, newest first' })
  favorites(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FoodProductListResponse> {
    return this.log.listFavorites(user.sub);
  }

  @Put('favorites/:productId')
  @ApiOperation({
    summary: 'Favorite an Open Food Facts product or one of your own',
  })
  favorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: FoodProductParamsDto,
  ): Promise<FoodProductResponse> {
    return this.log.favorite(user.sub, params.productId);
  }

  @Delete('favorites/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a favorite. Repeating this does nothing' })
  unfavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: FoodProductParamsDto,
  ): Promise<void> {
    return this.log.unfavorite(user.sub, params.productId);
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Distinct products from the caller’s log, newest first',
  })
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FoodRecentQueryDto,
  ): Promise<FoodRecentResponse> {
    return this.log.recent(user.sub, query);
  }

  @Get('log')
  @ApiOperation({
    summary: 'Daily log, totals, and what remains of the active target',
  })
  day(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FoodLogQueryDto,
  ): Promise<FoodDayResponse> {
    return this.log.day(user.sub, query.date);
  }

  @Post('log')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log grams of a product on a calendar date' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFoodLogDto,
  ): Promise<FoodLogEntryResponse> {
    return this.log.create(user.sub, body);
  }

  @Patch('log/:id')
  @ApiOperation({
    summary:
      'Edit one log entry. saveAsMyProduct copies it instead of changing the original',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: FoodLogParamsDto,
    @Body() body: PatchFoodLogDto,
  ): Promise<FoodLogEntryResponse> {
    return this.log.update(user.sub, params.id, body);
  }

  @Delete('log/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of your log entries' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: FoodLogParamsDto,
  ): Promise<void> {
    return this.log.remove(user.sub, params.id);
  }
}
