import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { ExerciseSeedCheck } from './exercise-seed.check.js';
import { ProgramTemplateConstraintCheck } from './program-template-constraint.check.js';
import { ProgramsController } from './programs.controller.js';
import { ProgramsService } from './programs.service.js';

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [ProgramsController],
  providers: [
    ProgramsService,
    ExerciseSeedCheck,
    ProgramTemplateConstraintCheck,
  ],
  exports: [ProgramsService],
})
export class ProgramsModule {}
