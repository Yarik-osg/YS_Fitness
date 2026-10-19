import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UsersService } from './users.service.js';
import {
  CreateMeasurementDto,
  CreateProgressPhotoDto,
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

  @Get('me/progress-photos')
  listProgressPhotos(@CurrentUser() user: AuthenticatedUser) {
    return this.users.listProgressPhotos(user.sub);
  }

  @Post('me/progress-photos')
  @HttpCode(201)
  createProgressPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateProgressPhotoDto,
  ) {
    return this.users.createProgressPhoto(user.sub, input.imageBase64);
  }

  @Get('me/progress-photos/:photoId')
  @Header('Cache-Control', 'private, no-store')
  async readProgressPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('photoId') photoId: string,
  ) {
    const image = await this.users.readProgressPhoto(user.sub, photoId);
    return new StreamableFile(image, { type: 'image/jpeg' });
  }

  @Delete('me/progress-photos/:photoId')
  @HttpCode(204)
  deleteProgressPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('photoId') photoId: string,
  ) {
    return this.users.deleteProgressPhoto(user.sub, photoId);
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
