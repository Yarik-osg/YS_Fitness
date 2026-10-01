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
import type {
  WorkoutLogListResponse,
  WorkoutLogResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { ListWorkoutLogsQueryDto } from './dto/list-workout-logs-query.dto.js';
import { LogWorkoutDto } from './dto/log-workout.dto.js';
import { WorkoutsService } from './workouts.service.js';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post('log')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SubscriptionGuard)
  log(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: LogWorkoutDto,
  ): Promise<WorkoutLogResponse> {
    return this.workouts.log(user.sub, input);
  }

  @Get('logs')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWorkoutLogsQueryDto,
  ): Promise<WorkoutLogListResponse> {
    return this.workouts.list(user.sub, query);
  }
}
