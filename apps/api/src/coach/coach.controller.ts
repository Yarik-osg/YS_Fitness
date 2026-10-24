import { Controller, Get, UseGuards } from '@nestjs/common';
import type { CoachClientsResponse } from '@repo/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
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
}
