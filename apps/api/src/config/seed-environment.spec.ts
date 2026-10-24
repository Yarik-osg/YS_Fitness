import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ownerAccountRole } from './seed-environment.js';

describe('owner account seed role', () => {
  it('creates and updates the owner as an admin', () => {
    expect(ownerAccountRole).toBe(UserRole.ADMIN);
  });
});
