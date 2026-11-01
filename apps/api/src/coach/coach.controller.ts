import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type {
  CoachNutritionResponse,
  CoachNutritionRosterResponse,
  CoachClientDetail,
  CoachClientWorkoutsResponse,
  CoachClientsResponse,
  CoachProgramClientsResponse,
  ProgressPhotosResponse,
  NutritionTargetResponse,
  StrengthChangesResponse,
  WeightMeasurementsResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { NutritionManualTargetDto } from '../nutrition/dto/nutrition-manual-target.dto.js';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { ListWorkoutLogsQueryDto } from '../workouts/dto/list-workout-logs-query.dto.js';
import {
  AssignClientProgramDto,
  CoachClientParamsDto,
  CoachNutritionCalculationParamsDto,
  UpdateCoachNoteDto,
  CoachClientPhotoParamsDto,
  CoachProgramParamsDto,
} from './coach.dto.js';
import { CoachService } from './coach.service.js';

@Controller('coach')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CoachController {
  constructor(
    private readonly coach: CoachService,
    private readonly nutrition: NutritionService,
  ) {}

  @Get('clients')
  listClients(): Promise<CoachClientsResponse> {
    return this.coach.listClients();
  }

  @Get('nutrition')
  listNutrition(): Promise<CoachNutritionRosterResponse> {
    return this.nutrition.listRoster(new Date());
  }

  @Get('programs/:templateId/clients')
  listProgramClients(
    @Param() params: CoachProgramParamsDto,
  ): Promise<CoachProgramClientsResponse> {
    return this.coach.listProgramClients(params.templateId);
  }

  @Get('clients/:userId')
  getClient(@Param() params: CoachClientParamsDto): Promise<CoachClientDetail> {
    return this.coach.getClient(params.userId);
  }

  @Post('clients/:userId/archive')
  @HttpCode(HttpStatus.OK)
  archiveClient(
    @Param() params: CoachClientParamsDto,
  ): Promise<{ id: string }> {
    return this.coach.archiveClient(params.userId);
  }

  @Post('clients/:userId/restore')
  @HttpCode(HttpStatus.OK)
  restoreClient(
    @Param() params: CoachClientParamsDto,
  ): Promise<{ id: string }> {
    return this.coach.restoreClient(params.userId);
  }

  @Patch('clients/:userId/note')
  updateNote(
    @Param() params: CoachClientParamsDto,
    @Body() body: UpdateCoachNoteDto,
  ): Promise<CoachClientDetail> {
    return this.coach.updateNote(params.userId, body);
  }

  @Post('clients/:userId/program')
  assignProgram(
    @Param() params: CoachClientParamsDto,
    @Body() body: AssignClientProgramDto,
  ): Promise<CoachClientDetail> {
    return this.coach.assignProgram(params.userId, body.templateId);
  }

  @Get('clients/:userId/workouts')
  listWorkouts(
    @Param() params: CoachClientParamsDto,
    @Query() query: ListWorkoutLogsQueryDto,
  ): Promise<CoachClientWorkoutsResponse> {
    return this.coach.listWorkouts(params.userId, query);
  }

  @Get('clients/:userId/nutrition')
  getNutrition(
    @Param() params: CoachClientParamsDto,
  ): Promise<CoachNutritionResponse> {
    return this.nutrition.getForCoach(params.userId);
  }

  @Put('clients/:userId/nutrition/targets')
  setNutritionTarget(
    @Param() params: CoachClientParamsDto,
    @Body() body: NutritionManualTargetDto,
  ): Promise<NutritionTargetResponse> {
    return this.nutrition.setManualTarget(params.userId, body);
  }

  @Post('clients/:userId/nutrition/calculations/:calculationId/activate')
  @HttpCode(HttpStatus.OK)
  applyNutritionCalculation(
    @Param() params: CoachNutritionCalculationParamsDto,
  ): Promise<NutritionTargetResponse> {
    return this.nutrition.applyCalculation(params.userId, params.calculationId);
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
