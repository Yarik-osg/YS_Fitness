import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';

function contextFor(role?: UserRole) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: role
          ? { sub: 'user-1', sessionId: 'session-1', role }
          : undefined,
      }),
    }),
  };
}

describe('RolesGuard', () => {
  it('allows a trainer to pass a trainer/admin role requirement', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['TRAINER', 'ADMIN']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextFor(UserRole.TRAINER) as never)).toBe(true);
  });

  it('forbids a client from trainer-only routes', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['TRAINER', 'ADMIN']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(contextFor(UserRole.CLIENT) as never),
    ).toThrow(ForbiddenException);
  });
});
