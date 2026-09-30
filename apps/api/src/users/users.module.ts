import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProgramsModule } from '../programs/programs.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, ProgramsModule, SubscriptionsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
