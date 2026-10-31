import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  NutritionCalculationCreatedResponse,
  NutritionCalculationListResponse,
  NutritionProfileGetResponse,
  NutritionProfileResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { NutritionProfileDto } from './dto/nutrition-profile.dto.js';
import { NutritionService } from './nutrition.service.js';

@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Get('profile')
  @UseGuards(SubscriptionGuard)
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NutritionProfileGetResponse> {
    return this.nutrition.getProfile(user.sub);
  }

  @Put('profile')
  @UseGuards(SubscriptionGuard)
  saveProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: NutritionProfileDto,
  ): Promise<NutritionProfileResponse> {
    return this.nutrition.saveProfile(user.sub, input);
  }

  @Get('calculations')
  @UseGuards(SubscriptionGuard)
  listCalculations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NutritionCalculationListResponse> {
    return this.nutrition.listCalculations(user.sub);
  }

  @Post('calculations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SubscriptionGuard)
  calculate(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NutritionCalculationCreatedResponse> {
    return this.nutrition.calculate(user.sub);
  }
}
