import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type {
  CoachClientDetail,
  CoachClientsResponse,
} from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CoachClientParamsDto } from './coach.dto.js';
import { CoachService } from './coach.service.js';

@Controller('coach')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TRAINER', 'ADMIN')
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
}
