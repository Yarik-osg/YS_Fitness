import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type {
  CoachClientSummary,
  CoachClientsResponse,
} from '@repo/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import { activeAccessWhere } from '../subscriptions/subscription-access.js';

@Injectable()
export class CoachService {
  constructor(private readonly prisma: PrismaService) {}

  async listClients(): Promise<CoachClientsResponse> {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: { role: UserRole.CLIENT },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        email: true,
        createdAt: true,
        profile: { select: { name: true, onboardingCompletedAt: true } },
        workoutProgram: { select: { id: true } },
        subscriptions: {
          where: activeAccessWhere(now),
          select: { id: true },
          take: 1,
        },
      },
    });

    return { clients: users.map(toSummary) };
  }
}

function toSummary(user: {
  id: string;
  email: string;
  createdAt: Date;
  profile: { name: string | null; onboardingCompletedAt: Date | null } | null;
  workoutProgram: { id: string } | null;
  subscriptions: { id: string }[];
}): CoachClientSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.profile?.name ?? null,
    createdAt: user.createdAt.toISOString(),
    onboardingCompleted: user.profile?.onboardingCompletedAt != null,
    programAssigned: user.workoutProgram != null,
    subscriptionActive: user.subscriptions.length > 0,
  };
}
