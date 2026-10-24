import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CoachController } from './coach.controller.js';
import { CoachService } from './coach.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
