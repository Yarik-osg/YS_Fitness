import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  OnboardingResponsesResponse,
  ProfileUpdateResponse,
  TrainingFrequency,
} from '@repo/shared-types';
import {
  isPlausibleDateOfBirth,
  type OnboardingInput,
  type ProfileUpdateInput,
} from '@repo/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ProgramsService,
  toProgramSummary,
} from '../programs/programs.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import {
  EXPERIENCE_FROM_PRISMA,
  EXPERIENCE_TO_PRISMA,
  MAIN_GOAL_FROM_PRISMA,
  MAIN_GOAL_TO_PRISMA,
  sameOnboardingResponses,
  toOnboardingResponsesRecord,
  toPrismaOnboardingResponses,
} from './onboarding-responses.mapper.js';

const PROFILE_INCOMPLETE = {
  code: 'PROFILE_INCOMPLETE',
  message: 'Complete onboarding before editing this profile',
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

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
            name: true,
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
            name: input.name,
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
            name: input.name,
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

  async updateProfile(
    userId: string,
    input: ProfileUpdateInput,
  ): Promise<ProfileUpdateResponse> {
    return this.prisma.$transaction(
      async (transaction) => {
        const [profile, latestMeasurement, responses] = await Promise.all([
          transaction.userProfile.findUnique({ where: { userId } }),
          transaction.bodyMeasurement.findFirst({
            where: { userId },
            orderBy: { measuredAt: 'desc' },
          }),
          transaction.onboardingResponses.findUnique({ where: { userId } }),
        ]);

        if (!profile) {
          throw new NotFoundException(PROFILE_INCOMPLETE);
        }

        if (input.heightCm !== undefined) {
          await transaction.userProfile.update({
            where: { userId },
            data: { heightCm: input.heightCm },
          });
        }

        const weightChanged =
          input.weightKg !== undefined &&
          (!latestMeasurement ||
            latestMeasurement.weightKg.toNumber() !== input.weightKg);

        if (weightChanged && input.weightKg !== undefined) {
          await transaction.bodyMeasurement.create({
            data: {
              userId,
              weightKg: input.weightKg,
              bodyFatPercent: latestMeasurement?.bodyFatPercent,
            },
          });
        }

        let storedResponses = responses;
        const responseUpdate: {
          experience?: (typeof EXPERIENCE_TO_PRISMA)[keyof typeof EXPERIENCE_TO_PRISMA];
          mainGoal?: (typeof MAIN_GOAL_TO_PRISMA)[keyof typeof MAIN_GOAL_TO_PRISMA];
          trainingFrequency?: TrainingFrequency;
        } = {};
        if (input.experience) {
          responseUpdate.experience = EXPERIENCE_TO_PRISMA[input.experience];
        }
        if (input.mainGoal) {
          responseUpdate.mainGoal = MAIN_GOAL_TO_PRISMA[input.mainGoal];
        }
        if (input.trainingFrequency) {
          responseUpdate.trainingFrequency = input.trainingFrequency;
        }

        if (!storedResponses) {
          if (
            input.experience !== undefined &&
            input.mainGoal !== undefined &&
            input.trainingFrequency !== undefined
          ) {
            storedResponses = await transaction.onboardingResponses.create({
              data: {
                userId,
                programTrack:
                  profile.biologicalSexForCalculation === 'MALE'
                    ? 'MALE'
                    : 'FEMALE',
                currentBody: '',
                desiredBody: '',
                mainGoal: MAIN_GOAL_TO_PRISMA[input.mainGoal],
                experience: EXPERIENCE_TO_PRISMA[input.experience],
                trainingFrequency: input.trainingFrequency,
                focusAreas: [],
                nutritionCurrent: 'BALANCED',
                mealsPerDay: '',
                eatingHabits: [],
              },
            });
          } else if (
            input.experience !== undefined ||
            input.mainGoal !== undefined ||
            input.trainingFrequency !== undefined
          ) {
            throw new NotFoundException(PROFILE_INCOMPLETE);
          }
        } else if (
          responseUpdate.experience ||
          responseUpdate.mainGoal ||
          responseUpdate.trainingFrequency
        ) {
          await transaction.onboardingResponses.update({
            where: { userId },
            data: responseUpdate,
          });
        }

        const weightKg =
          input.weightKg ?? latestMeasurement?.weightKg.toNumber();
        if (weightKg === undefined) {
          throw new NotFoundException(PROFILE_INCOMPLETE);
        }

        const program = await this.resolveAssignedProgram(userId, transaction, {
          reassign:
            hasMatchableFocus(storedResponses) &&
            matchFieldsChanged(responses, input),
        });

        return {
          heightCm: input.heightCm ?? profile.heightCm.toNumber(),
          weightKg,
          experience:
            input.experience ??
            (storedResponses
              ? EXPERIENCE_FROM_PRISMA[storedResponses.experience]
              : null),
          mainGoal:
            input.mainGoal ??
            (storedResponses
              ? MAIN_GOAL_FROM_PRISMA[storedResponses.mainGoal]
              : null),
          trainingFrequency:
            input.trainingFrequency ??
            (storedResponses
              ? (storedResponses.trainingFrequency as TrainingFrequency)
              : null),
          program,
        };
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

  private async resolveAssignedProgram(
    userId: string,
    transaction: Prisma.TransactionClient,
    options: { reassign: boolean },
  ) {
    if (!(await this.subscriptions.hasActiveAccess(userId))) {
      return null;
    }
    const current = await this.programs.getAssigned(userId, transaction);
    if (!options.reassign) {
      return current.program;
    }

    try {
      return toProgramSummary(
        await this.programs.assign(userId, transaction, {
          preserveAssignedAt: true,
        }),
      );
    } catch (error) {
      if (isProgramNotAvailable(error)) {
        await this.programs.unassign(userId, transaction);
        return null;
      }
      throw error;
    }
  }

  private validateDateOfBirth(value: string): Date {
    if (!isPlausibleDateOfBirth(value)) {
      throw new BadRequestException({
        code: 'INVALID_DATE_OF_BIRTH',
        message: 'dateOfBirth must be a real date within the last 120 years',
      });
    }

    return new Date(`${value}T00:00:00.000Z`);
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

function isProgramNotAvailable(error: unknown): boolean {
  if (!(error instanceof NotFoundException)) {
    return false;
  }
  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    response.code === 'PROGRAM_NOT_AVAILABLE'
  );
}

function hasMatchableFocus(stored: { focusAreas: string[] } | null): boolean {
  return Boolean(stored?.focusAreas[0]);
}

function matchFieldsChanged(
  stored: {
    experience: string;
    mainGoal: string;
    trainingFrequency: string;
  } | null,
  input: ProfileUpdateInput,
): boolean {
  if (!stored) return false;
  return (
    (input.experience !== undefined &&
      input.experience !==
        EXPERIENCE_FROM_PRISMA[
          stored.experience as keyof typeof EXPERIENCE_FROM_PRISMA
        ]) ||
    (input.mainGoal !== undefined &&
      input.mainGoal !==
        MAIN_GOAL_FROM_PRISMA[
          stored.mainGoal as keyof typeof MAIN_GOAL_FROM_PRISMA
        ]) ||
    (input.trainingFrequency !== undefined &&
      input.trainingFrequency !== stored.trainingFrequency)
  );
}
