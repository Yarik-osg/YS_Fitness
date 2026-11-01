import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  OnboardingResponsesResponse,
  ProfileUpdateResponse,
  ProgressPhoto,
  ProgressPhotosResponse,
  TrainingFrequency,
  WeightMeasurement,
} from '@repo/shared-types';
import {
  FEMALE_FOCUS_AREAS,
  isPlausibleDateOfBirth,
  MALE_FOCUS_AREAS,
  type OnboardingInput,
  type ProfileUpdateInput,
} from '@repo/validation';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ProgramsService,
  toProgramSummary,
} from '../programs/programs.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import {
  decodeProgressPhoto,
  ProgressPhotoError,
  type ProgressPhotoContentType,
} from './progress-photo.js';
import {
  LocalProgressPhotoStorage,
  type ProgressPhotoStorage,
} from './progress-photo-storage.js';
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

const INVALID_FOCUS = {
  code: 'INVALID_FOCUS_AREA',
  message: 'Focus is not available for this program',
};

const CHART_MEASUREMENT_LIMIT = 1000;
const PROGRESS_PHOTO_LIMIT = 8;

const latestMeasurementOrder = [
  { measuredAt: 'desc' as const },
  { id: 'desc' as const },
];

const firstMeasurementOrder = [
  { measuredAt: 'asc' as const },
  { id: 'asc' as const },
];

const weightMeasurementSelect = {
  id: true,
  weightKg: true,
  measuredAt: true,
} as const;

function asProgressPhotoType(value: string): ProgressPhotoContentType | null {
  if (
    value === 'image/jpeg' ||
    value === 'image/png' ||
    value === 'image/webp'
  ) {
    return value;
  }
  return null;
}

function isMissingRecord(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2025'
  );
}

function assertPhotoId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new BadRequestException({
      code: 'PHOTO_INVALID',
      message: 'Photo id is not valid.',
    });
  }
}

function toProgressPhoto(row: {
  id: string;
  createdAt: Date;
  contentType: string;
  width: number;
  height: number;
}): ProgressPhoto {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    contentType: 'image/jpeg',
    width: row.width,
    height: row.height,
  };
}

function toWeightMeasurement(row: {
  id: string;
  weightKg: Prisma.Decimal;
  measuredAt: Date;
}): WeightMeasurement {
  return {
    id: row.id,
    weightKg: row.weightKg.toNumber(),
    measuredAt: row.measuredAt.toISOString(),
  };
}

function chartOrder<T extends { id: string; measuredAt: Date }>(
  rows: T[],
): T[] {
  return rows.slice().sort((left, right) => {
    const byTime = left.measuredAt.getTime() - right.measuredAt.getTime();
    if (byTime !== 0) return byTime;
    if (left.id === right.id) return 0;
    return left.id < right.id ? 1 : -1;
  });
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  private async refreshNutrition(userId: string) {
    if (!this.nutrition) return;
    try {
      await this.nutrition.refreshAfterWeightChange(userId);
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Nutrition refresh failed',
      );
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
    private readonly subscriptions: SubscriptionsService,
    @Optional()
    @Inject(LocalProgressPhotoStorage)
    private readonly photos?: ProgressPhotoStorage,
    private readonly nutrition?: NutritionService,
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
          orderBy: latestMeasurementOrder,
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

  async listMeasurements(userId: string) {
    const [rows, first] = await Promise.all([
      this.prisma.bodyMeasurement.findMany({
        where: { userId },
        orderBy: latestMeasurementOrder,
        take: CHART_MEASUREMENT_LIMIT,
        select: weightMeasurementSelect,
      }),
      this.prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: firstMeasurementOrder,
        select: weightMeasurementSelect,
      }),
    ]);

    return {
      measurements: chartOrder(rows).map(toWeightMeasurement),
      firstMeasurement: first ? toWeightMeasurement(first) : null,
    };
  }

  async createMeasurement(userId: string, weightKg: number) {
    const created = await this.prisma.bodyMeasurement.create({
      data: {
        userId,
        weightKg,
        measuredAt: new Date(),
      },
      select: weightMeasurementSelect,
    });

    await this.refreshNutrition(userId);
    return toWeightMeasurement(created);
  }

  async listProgressPhotos(userId: string): Promise<ProgressPhotosResponse> {
    const rows = await this.prisma.progressPhoto.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return {
      photos: rows.flatMap((row) => {
        const contentType = asProgressPhotoType(row.contentType);
        if (contentType !== 'image/jpeg') return [];
        return [
          {
            id: row.id,
            createdAt: row.createdAt.toISOString(),
            contentType,
            width: row.width,
            height: row.height,
          },
        ];
      }),
    };
  }

  async readProgressPhoto(userId: string, photoId: string): Promise<Buffer> {
    assertPhotoId(photoId);
    const row = await this.prisma.progressPhoto.findFirst({
      where: { id: photoId, userId },
    });
    const image = row ? await this.photoStorage().read(row.storageKey) : null;
    if (!image) {
      throw new NotFoundException({
        code: 'PHOTO_NOT_FOUND',
        message: 'Progress photo not found.',
      });
    }
    return image;
  }

  async createProgressPhoto(
    userId: string,
    imageBase64: string,
  ): Promise<ProgressPhoto> {
    let decoded: Awaited<ReturnType<typeof decodeProgressPhoto>>;
    try {
      decoded = await decodeProgressPhoto(imageBase64);
    } catch (error) {
      if (error instanceof ProgressPhotoError) {
        throw new BadRequestException({
          code: error.code,
          message: 'Use a JPEG, PNG, or WebP under 400 KB and 1024 pixels.',
        });
      }
      throw error;
    }

    const id = randomUUID();
    const storageKey = `${userId}/${id}.jpg`;
    await this.photoStorage().save(storageKey, decoded.image);
    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE
        `;
        const count = await transaction.progressPhoto.count({
          where: { userId },
        });
        if (count >= PROGRESS_PHOTO_LIMIT) {
          throw new BadRequestException({
            code: 'PHOTO_LIMIT',
            message: 'Progress photo limit reached.',
          });
        }
        return transaction.progressPhoto.create({
          data: {
            id,
            userId,
            contentType: decoded.contentType,
            storageKey,
            width: decoded.width,
            height: decoded.height,
          },
        });
      });
      return toProgressPhoto(created);
    } catch (error) {
      await this.removeStoredPhoto(storageKey);
      throw error;
    }
  }

  async deleteProgressPhoto(userId: string, photoId: string): Promise<void> {
    assertPhotoId(photoId);
    const row = await this.prisma.progressPhoto.findFirst({
      where: { id: photoId, userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'PHOTO_NOT_FOUND',
        message: 'Progress photo not found.',
      });
    }
    try {
      await this.photoStorage().remove(row.storageKey);
    } catch (error) {
      this.logger.error(
        `Progress photo ${row.id} was kept because its file could not be removed`,
      );
      this.logger.error(error instanceof Error ? error.message : 'unknown');
      throw new InternalServerErrorException({
        code: 'PHOTO_DELETE_FAILED',
        message: 'The photo could not be deleted. Try again.',
      });
    }
    try {
      await this.prisma.progressPhoto.delete({ where: { id: row.id } });
    } catch (error) {
      if (isMissingRecord(error)) return;
      this.logger.error(
        `Progress photo ${row.id} file was removed and the row delete failed`,
      );
      this.logger.error(error instanceof Error ? error.message : 'unknown');
      throw error;
    }
  }

  private photoStorage(): ProgressPhotoStorage {
    if (!this.photos) {
      throw new Error('Progress photo storage is not configured');
    }
    return this.photos;
  }

  private async removeStoredPhoto(storageKey: string) {
    try {
      await this.photoStorage().remove(storageKey);
    } catch (error) {
      this.logger.error(
        `Progress photo file was left on disk after ${storageKey} could not be removed`,
      );
      this.logger.error(error instanceof Error ? error.message : 'unknown');
    }
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
              orderBy: latestMeasurementOrder,
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
    const updated = await this.prisma.$transaction(
      async (transaction) => {
        await this.programs.holdAssignment(userId, transaction);
        const [profile, latestMeasurement, responses] = await Promise.all([
          transaction.userProfile.findUnique({ where: { userId } }),
          transaction.bodyMeasurement.findFirst({
            where: { userId },
            orderBy: latestMeasurementOrder,
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
          focusAreas?: string[];
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
        if (input.focusAreas?.[0]) {
          if (!responses) {
            throw new NotFoundException(PROFILE_INCOMPLETE);
          }
          assertAllowedFocus(responses.programTrack, input.focusAreas[0]);
          if (input.focusAreas[0] !== responses.focusAreas[0]) {
            responseUpdate.focusAreas = [input.focusAreas[0]];
          }
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
          responseUpdate.trainingFrequency ||
          responseUpdate.focusAreas
        ) {
          await transaction.onboardingResponses.update({
            where: { userId },
            data: responseUpdate,
          });
          if (responseUpdate.focusAreas) {
            storedResponses = {
              ...storedResponses,
              focusAreas: responseUpdate.focusAreas,
            };
          }
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
          focusAreas: storedResponses?.focusAreas ?? null,
          program,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (input.weightKg !== undefined) {
      await this.refreshNutrition(userId);
    }
    return updated;
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
          onTrainerProgram: 'keep',
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

function assertAllowedFocus(track: string, focus: string) {
  const allowed = track === 'MALE' ? MALE_FOCUS_AREAS : FEMALE_FOCUS_AREAS;
  if (!(allowed as readonly string[]).includes(focus)) {
    throw new BadRequestException(INVALID_FOCUS);
  }
}

function matchFieldsChanged(
  stored: {
    experience: string;
    mainGoal: string;
    trainingFrequency: string;
    focusAreas: string[];
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
      input.trainingFrequency !== stored.trainingFrequency) ||
    (input.focusAreas !== undefined &&
      input.focusAreas[0] !== stored.focusAreas[0])
  );
}
