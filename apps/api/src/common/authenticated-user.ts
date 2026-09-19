import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  sub: string;
  sessionId: string;
  role: UserRole;
}
