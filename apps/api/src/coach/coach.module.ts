import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { WorkoutsModule } from '../workouts/workouts.module.js';
import { CoachController } from './coach.controller.js';
import { CoachService } from './coach.service.js';

@Module({
  imports: [AuthModule, UsersModule, WorkoutsModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
