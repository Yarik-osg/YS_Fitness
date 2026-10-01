import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { WorkoutsController } from './workouts.controller.js';

const GUARDS_METADATA = '__guards__';

describe('WorkoutsController guards', () => {
  it('requires an active subscription to log and only a JWT to list', () => {
    const logGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      WorkoutsController.prototype.log,
    );
    const listGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      WorkoutsController.prototype.list,
    );
    const controllerGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      WorkoutsController,
    );

    expect(controllerGuards).toEqual([JwtAuthGuard]);
    expect(logGuards).toEqual([SubscriptionGuard]);
    expect(listGuards).toBeUndefined();
  });
});
