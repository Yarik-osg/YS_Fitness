import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { ProgramsController } from './programs.controller.js';

const GUARDS_METADATA = '__guards__';

describe('ProgramsController', () => {
  it('keeps GET /programs/me behind SubscriptionGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ProgramsController.prototype.getMine,
      ),
    ).toEqual([SubscriptionGuard]);
  });

  it('keeps GET /programs/assigned behind SubscriptionGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ProgramsController.prototype.getAssigned,
      ),
    ).toEqual([SubscriptionGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, ProgramsController)).toEqual([
      JwtAuthGuard,
    ]);
  });
});
