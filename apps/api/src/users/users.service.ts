import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OnboardingResponsesResponse } from '@repo/shared-types';
import type { OnboardingInput } from '@repo/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  sameOnboardingResponses,
  toOnboardingResponsesRecord,
  toPrismaOnboardingResponses,
} from './onboarding-responses.mapper.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: {
          select: {
            dateOfBirth: true,
            biologicalSexForCalculation: true,
            heightCm: true,
            activityLevel: true,
            goal: true,
            healthRestrictions: true,
            timezone: true,
            onboardingCompletedAt: true,
          },
        },
        bodyMeasurements: {
          orderBy: { measuredAt: 'desc' },
          take: 1,
          select: {
            id: true,
            weightKg: true,
            bodyFatPercent: true,
            measuredAt: true,
          },
        },
      },
    });
  }

  async saveOnboarding(userId: string, input: OnboardingInput) {
    const dateOfBirth = this.validateDateOfBirth(input.dateOfBirth);
    this.validateTimezone(input.timezone);

    return this.prisma.$transaction(
      async (transaction) => {
        const [existingProfile, latestMeasurement, existingResponses] =
          await Promise.all([
            transaction.userProfile.findUnique({ where: { userId } }),
            transaction.bodyMeasurement.findFirst({
              where: { userId },
              orderBy: { measuredAt: 'desc' },
            }),
            transaction.onboardingResponses.findUnique({ where: { userId } }),
          ]);

        const completedAt =
          existingProfile?.onboardingCompletedAt ?? new Date();
        const healthRestrictions = input.healthRestrictions ?? Prisma.JsonNull;

        const profile = await transaction.userProfile.upsert({
          where: { userId },
          create: {
            userId,
            dateOfBirth,
            biologicalSexForCalculation: input.biologicalSexForCalculation,
            heightCm: input.heightCm,
            activityLevel: input.activityLevel,
            goal: input.goal,
            healthRestrictions,
            timezone: input.timezone,
            onboardingCompletedAt: completedAt,
          },
          update: {
            dateOfBirth,
            biologicalSexForCalculation: input.biologicalSexForCalculation,
            heightCm: input.heightCm,
            activityLevel: input.activityLevel,
            goal: input.goal,
            healthRestrictions,
            timezone: input.timezone,
            onboardingCompletedAt: completedAt,
          },
        });

        const hasMeasurementChanged =
          !latestMeasurement ||
          latestMeasurement.weightKg.toNumber() !== input.weightKg ||
          this.optionalDecimal(latestMeasurement.bodyFatPercent) !==
            (input.bodyFatPercent ?? null);

        const measurement = hasMeasurementChanged
          ? await transaction.bodyMeasurement.create({
              data: {
                userId,
                weightKg: input.weightKg,
                bodyFatPercent: input.bodyFatPercent,
              },
            })
          : latestMeasurement;

        const responsesData = toPrismaOnboardingResponses(input);
        if (
          !existingResponses ||
          !sameOnboardingResponses(existingResponses, input)
        ) {
          await transaction.onboardingResponses.upsert({
            where: { userId },
            create: { userId, ...responsesData },
            update: responsesData,
          });
        }

        return { profile, measurement };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getOnboardingResponses(
    userId: string,
  ): Promise<OnboardingResponsesResponse> {
    const row = await this.prisma.onboardingResponses.findUnique({
      where: { userId },
    });
    return {
      responses: row ? toOnboardingResponsesRecord(row) : null,
    };
  }

  private validateDateOfBirth(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    const now = new Date();
    const oldest = new Date(
      Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate()),
    );

    if (
      Number.isNaN(date.getTime()) ||
      date > now ||
      date < oldest ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException({
        code: 'INVALID_DATE_OF_BIRTH',
        message: 'dateOfBirth must be a real date within the last 120 years',
      });
    }

    return date;
  }

  private validateTimezone(value: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    } catch {
      throw new BadRequestException({
        code: 'INVALID_TIMEZONE',
        message: 'timezone must be a valid IANA timezone',
      });
    }
  }

  private optionalDecimal(value: Prisma.Decimal | null): number | null {
    return value?.toNumber() ?? null;
  }
}
