import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  ExerciseResponse,
  TrainerProgramTemplateDetail,
  TrainerProgramTemplateListResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import {
  TrainerTemplateBodyDto,
  TrainerTemplateParamsDto,
} from './dto/trainer-template.dto.js';
import {
  TrainerTemplatesService,
  type TrainerTemplateActor,
} from './trainer-templates.service.js';

function actor(user: AuthenticatedUser): TrainerTemplateActor {
  return { id: user.sub, role: user.role };
}

@Controller('coach/program-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TrainerTemplatesController {
  constructor(private readonly templates: TrainerTemplatesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrainerProgramTemplateListResponse> {
    return this.templates.list(actor(user));
  }

  @Get('exercises')
  listExercises(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExerciseResponse[]> {
    return this.templates.listExercises(actor(user));
  }

  @Get(':templateId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: TrainerTemplateParamsDto,
  ): Promise<TrainerProgramTemplateDetail> {
    return this.templates.get(actor(user), params.templateId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: TrainerTemplateBodyDto,
  ): Promise<TrainerProgramTemplateDetail> {
    return this.templates.create(actor(user), input);
  }

  @Put(':templateId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: TrainerTemplateParamsDto,
    @Body() input: TrainerTemplateBodyDto,
  ): Promise<TrainerProgramTemplateDetail> {
    return this.templates.update(actor(user), params.templateId, input);
  }

  @Post(':templateId/duplicate')
  @HttpCode(HttpStatus.CREATED)
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: TrainerTemplateParamsDto,
  ): Promise<TrainerProgramTemplateDetail> {
    return this.templates.duplicate(actor(user), params.templateId);
  }

  @Delete(':templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: TrainerTemplateParamsDto,
  ): Promise<void> {
    return this.templates.remove(actor(user), params.templateId);
  }
}
