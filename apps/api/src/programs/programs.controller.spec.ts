import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { ProgramsController } from './programs.controller.js';

const GUARDS_METADATA = '__guards__';

function guardsOn(target: object) {
  return (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
}

describe('ProgramsController guards', () => {
  it('requires an active subscription to assign and read the current program', () => {
    expect(guardsOn(ProgramsController)).toContain(JwtAuthGuard);
    expect(guardsOn(ProgramsController.prototype.assign)).toContain(
      SubscriptionGuard,
    );
    expect(guardsOn(ProgramsController.prototype.getMine)).toContain(
      SubscriptionGuard,
    );
  });

  it('leaves the exercise list available without a subscription', () => {
    expect(guardsOn(ProgramsController.prototype.listExercises)).not.toContain(
      SubscriptionGuard,
    );
  });
});
