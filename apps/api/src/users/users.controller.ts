import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UsersService } from './users.service.js';
import {
  CreateMeasurementDto,
  OnboardingDto,
  ProfileUpdateDto,
} from './users.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getMe(user.sub);
  }

  @Get('me/measurements')
  listMeasurements(@CurrentUser() user: AuthenticatedUser) {
    return this.users.listMeasurements(user.sub);
  }

  @Post('me/measurements')
  @HttpCode(201)
  createMeasurement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateMeasurementDto,
  ) {
    return this.users.createMeasurement(user.sub, input.weightKg);
  }

  @Put('me/onboarding')
  saveOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: OnboardingDto,
  ) {
    return this.users.saveOnboarding(user.sub, input);
  }

  @Get('me/onboarding-responses')
  getOnboardingResponses(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getOnboardingResponses(user.sub);
  }

  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ProfileUpdateDto,
  ) {
    return this.users.updateProfile(user.sub, input);
  }
}
