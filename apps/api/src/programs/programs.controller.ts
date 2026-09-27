import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AssignedProgramResponse,
  CurrentProgramResponse,
  ExerciseResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto.js';
import { ProgramsService } from './programs.service.js';

@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Post('assign')
  @UseGuards(SubscriptionGuard)
  assign(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignedProgramResponse> {
    return this.programs.assign(user.sub);
  }

  @Get('me')
  @UseGuards(SubscriptionGuard)
  getMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentProgramResponse> {
    return this.programs.getMine(user.sub);
  }

  @Get('exercises')
  listExercises(
    @Query() query: ListExercisesQueryDto,
  ): Promise<ExerciseResponse[]> {
    return this.programs.listExercises(query);
  }
}
