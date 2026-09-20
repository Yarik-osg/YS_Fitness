import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const userId = request.user?.sub;

    if (!userId || !(await this.subscriptions.hasActiveAccess(userId))) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required',
      });
    }

    return true;
  }
}
