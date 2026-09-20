import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  CheckoutResponse,
  PlanResponse,
  SubscriptionResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  listPlans(): Promise<PlanResponse[]> {
    return this.subscriptions.listPlans();
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CheckoutDto,
  ): Promise<CheckoutResponse> {
    return this.subscriptions.checkout(user.sub, input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubscriptionResponse | null> {
    return this.subscriptions.getMine(user.sub);
  }

  @Post('grant')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TRAINER', 'ADMIN')
  grant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: GrantSubscriptionDto,
  ): Promise<SubscriptionResponse> {
    return this.subscriptions.grant(user.sub, input);
  }
}
