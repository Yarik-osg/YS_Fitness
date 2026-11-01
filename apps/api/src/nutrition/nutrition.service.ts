import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type NutritionCalculation } from '@prisma/client';
import type {
  NutritionCalculationCreatedResponse,
  NutritionCalculationListResponse,
  NutritionCalculationResponse,
  NutritionProfileGetResponse,
  NutritionProfileResponse,
} from '@repo/shared-types';
import type { NutritionProfileInput } from '@repo/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import { ageInTimeZone } from './nutrition-age.js';
import {
  mealCountFromBand,
  nutritionActivityFromDailyActivity,
  nutritionGoalFromTrainingGoal,
} from './nutrition-from-onboarding.js';
import {
  calculateNutrition,
  NutritionInputError,
  type NutritionFrequency,
} from './nutrition-calculation.js';

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<NutritionProfileGetResponse> {
    await this.assertClient(userId);
    const profile = await this.prisma.nutritionProfile.findUnique({
      where: { userId },
    });
    return { profile: profile ? toProfile(profile) : null };
  }

  async saveProfile(
    userId: string,
    input: NutritionProfileInput,
  ): Promise<NutritionProfileResponse> {
    await this.assertClient(userId);
    const data = {
      activity: input.activity,
      goal: input.goal,
      preferences: input.preferences,
      allergies: input.allergies,
      dislikes: input.dislikes,
      mealCount: input.mealCount,
    };
    const profile = await this.prisma.nutritionProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return toProfile(profile);
  }

  async listCalculations(
    userId: string,
  ): Promise<NutritionCalculationListResponse> {
    await this.assertClient(userId);
    const rows = await this.prisma.nutritionCalculation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { calculations: rows.map(toCalculation) };
  }

  async calculate(
    userId: string,
    now = new Date(),
  ): Promise<NutritionCalculationCreatedResponse> {
    await this.assertClient(userId);
    const inputs = await this.calculationInputs(userId, now);
    const result = calculateOrReject(inputs);

    return this.prisma.$transaction(async (db) => {
      const locked = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException({
          code: 'CLIENT_NOT_FOUND',
          message: 'Client not found',
        });
      }
      const already = await db.nutritionCalculation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (already) {
        return { ...toCalculation(already), activatedTarget: false };
      }

      if (inputs.profileToCreate) {
        try {
          await db.nutritionProfile.create({
            data: { userId, ...inputs.profileToCreate },
          });
        } catch (error) {
          if (!isUniqueConflict(error)) throw error;
        }
      }

      const active = await db.nutritionTarget.findFirst({
        where: { userId, active: true },
      });
      const calculation = await db.nutritionCalculation.create({
        data: {
          userId,
          weightKg: inputs.weightKg,
          heightCm: inputs.heightCm,
          ageYears: inputs.ageYears,
          sex: inputs.sex,
          activity: inputs.activity,
          frequency: inputs.frequency,
          goal: inputs.goal,
          activityMultiplier: result.activityMultiplier,
          goalAdjustment: result.goalAdjustment,
          bmr: result.bmr,
          tdee: result.tdee,
          targetCalories: result.targetCalories,
          proteinGrams: result.proteinGrams,
          fatGrams: result.fatGrams,
          carbsGrams: result.carbsGrams,
          carbsNonPositive: result.carbsNonPositive,
        },
      });
      const activatedTarget = !active || active.source === 'CALCULATED';
      if (activatedTarget) {
        if (active) {
          await db.nutritionTarget.update({
            where: { id: active.id },
            data: { active: false },
          });
        }
        await db.nutritionTarget.create({
          data: {
            userId,
            active: true,
            source: 'CALCULATED',
            calculationId: calculation.id,
            targetCalories: result.targetCalories,
            proteinGrams: result.proteinGrams,
            fatGrams: result.fatGrams,
            carbsGrams: result.carbsGrams,
          },
        });
      }
      return { ...toCalculation(calculation), activatedTarget };
    });
  }

  private async assertClient(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== 'CLIENT') {
      throw new NotFoundException({
        code: 'CLIENT_NOT_FOUND',
        message: 'Client not found',
      });
    }
  }

  private async calculationInputs(userId: string, now: Date) {
    const [profile, body, measurement, onboarding] = await Promise.all([
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.onboardingResponses.findUnique({
        where: { userId },
        select: { trainingFrequency: true, mealsPerDay: true },
      }),
    ]);
    if (!body || !measurement) {
      throw unsupported('Nutrition inputs are incomplete');
    }
    const activity = profile
      ? profile.activity
      : nutritionActivityFromDailyActivity(body.activityLevel);
    const goal = profile
      ? profile.goal
      : nutritionGoalFromTrainingGoal(body.goal);
    try {
      return {
        sex: body.biologicalSexForCalculation,
        weightKg: measurement.weightKg,
        heightCm: body.heightCm,
        ageYears: ageInTimeZone(body.dateOfBirth, body.timezone, now),
        activity,
        frequency: frequencyOf(onboarding?.trainingFrequency),
        goal,
        profileToCreate: profile
          ? null
          : {
              activity,
              goal,
              preferences: null,
              allergies: null,
              dislikes: null,
              mealCount: mealCountFromBand(onboarding?.mealsPerDay),
            },
      };
    } catch (error) {
      if (error instanceof NutritionInputError)
        throw unsupported(error.message);
      throw error;
    }
  }
}

function calculateOrReject(inputs: Parameters<typeof calculateNutrition>[0]) {
  try {
    return calculateNutrition(inputs);
  } catch (error) {
    if (error instanceof NutritionInputError) throw unsupported(error.message);
    throw error;
  }
}

function frequencyOf(value: string | undefined): NutritionFrequency {
  if (value === '2' || value === '3' || value === '4') {
    return Number(value) as NutritionFrequency;
  }
  throw new NutritionInputError(
    'activity and workout frequency are not a supported pair',
  );
}

function unsupported(message: string): never {
  throw new BadRequestException({
    code: 'NUTRITION_INPUT_UNSUPPORTED',
    message,
  });
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function decimal(value: Prisma.Decimal) {
  return value.toString();
}

function toProfile(profile: {
  activity: NutritionProfileResponse['activity'];
  goal: NutritionProfileResponse['goal'];
  preferences: string | null;
  allergies: string | null;
  dislikes: string | null;
  mealCount: number;
}): NutritionProfileResponse {
  return {
    activity: profile.activity,
    goal: profile.goal,
    preferences: profile.preferences,
    allergies: profile.allergies,
    dislikes: profile.dislikes,
    mealCount: profile.mealCount,
  };
}

function toCalculation(
  row: NutritionCalculation,
): NutritionCalculationResponse {
  const frequency = row.frequency;
  if (frequency !== 2 && frequency !== 3 && frequency !== 4) {
    throw unsupported(
      'activity and workout frequency are not a supported pair',
    );
  }
  return {
    id: row.id,
    weightKg: decimal(row.weightKg),
    heightCm: decimal(row.heightCm),
    ageYears: row.ageYears,
    sex: row.sex,
    activity: row.activity,
    frequency,
    goal: row.goal,
    activityMultiplier: decimal(row.activityMultiplier),
    goalAdjustment: decimal(row.goalAdjustment),
    bmr: decimal(row.bmr),
    tdee: decimal(row.tdee),
    targetCalories: decimal(row.targetCalories),
    proteinGrams: decimal(row.proteinGrams),
    fatGrams: decimal(row.fatGrams),
    carbsGrams: decimal(row.carbsGrams),
    carbsNonPositive: row.carbsNonPositive,
    createdAt: row.createdAt.toISOString(),
  };
}
