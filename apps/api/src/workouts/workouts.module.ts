import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProgramsModule } from '../programs/programs.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { WorkoutsController } from './workouts.controller.js';
import { WorkoutsRepository } from './workouts.repository.js';
import { WorkoutsService } from './workouts.service.js';

@Module({
  imports: [AuthModule, ProgramsModule, SubscriptionsModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsRepository, WorkoutsService],
})
export class WorkoutsModule {}
