import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { UsersController } from './users.controller.js';

const GUARDS_METADATA = '__guards__';

describe('UsersController measurements', () => {
  it('requires JWT and does not require a subscription', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toEqual([
      JwtAuthGuard,
    ]);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        UsersController.prototype.listMeasurements,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        UsersController.prototype.createMeasurement,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        UsersController.prototype.listProgressPhotos,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        UsersController.prototype.createProgressPhoto,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        UsersController.prototype.readProgressPhoto,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        UsersController.prototype.deleteProgressPhoto,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        UsersController.prototype.listMeasurements,
      ),
    ).not.toEqual([SubscriptionGuard]);
  });
});
