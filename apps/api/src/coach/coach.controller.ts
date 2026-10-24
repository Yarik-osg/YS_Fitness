import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type {
  CoachClientDetail,
  CoachClientWorkoutsResponse,
  CoachClientsResponse,
  ProgressPhotosResponse,
  StrengthChangesResponse,
  WeightMeasurementsResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ListWorkoutLogsQueryDto } from '../workouts/dto/list-workout-logs-query.dto.js';
import {
  CoachClientParamsDto,
  CoachClientPhotoParamsDto,
} from './coach.dto.js';
import { CoachService } from './coach.service.js';

@Controller('coach')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get('clients')
  listClients(): Promise<CoachClientsResponse> {
    return this.coach.listClients();
  }

  @Get('clients/:userId')
  getClient(@Param() params: CoachClientParamsDto): Promise<CoachClientDetail> {
    return this.coach.getClient(params.userId);
  }

  @Get('clients/:userId/workouts')
  listWorkouts(
    @Param() params: CoachClientParamsDto,
    @Query() query: ListWorkoutLogsQueryDto,
  ): Promise<CoachClientWorkoutsResponse> {
    return this.coach.listWorkouts(params.userId, query);
  }

  @Get('clients/:userId/measurements')
  listMeasurements(
    @Param() params: CoachClientParamsDto,
  ): Promise<WeightMeasurementsResponse> {
    return this.coach.listMeasurements(params.userId);
  }

  @Get('clients/:userId/strength')
  listStrength(
    @Param() params: CoachClientParamsDto,
  ): Promise<StrengthChangesResponse> {
    return this.coach.listStrength(params.userId);
  }

  @Get('clients/:userId/progress-photos')
  listProgressPhotos(
    @Param() params: CoachClientParamsDto,
  ): Promise<ProgressPhotosResponse> {
    return this.coach.listProgressPhotos(params.userId);
  }

  @Get('clients/:userId/progress-photos/:photoId')
  @Header('Cache-Control', 'private, no-store')
  async readProgressPhoto(
    @Param() params: CoachClientPhotoParamsDto,
  ): Promise<StreamableFile> {
    const image = await this.coach.readProgressPhoto(
      params.userId,
      params.photoId,
    );
    return new StreamableFile(image, { type: 'image/jpeg' });
  }
}
