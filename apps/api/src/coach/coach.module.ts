import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { ProgramsModule } from '../programs/programs.module.js';
import { TrainerTemplatesController } from '../programs/trainer-templates.controller.js';
import { UsersModule } from '../users/users.module.js';
import { WorkoutsModule } from '../workouts/workouts.module.js';
import { CoachController } from './coach.controller.js';
import { CoachService } from './coach.service.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WorkoutsModule,
    ProgramsModule,
    MailModule,
  ],
  controllers: [CoachController, TrainerTemplatesController],
  providers: [CoachService],
})
export class CoachModule {}
