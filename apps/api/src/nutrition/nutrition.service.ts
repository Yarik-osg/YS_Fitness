import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type NutritionCalculation } from '@prisma/client';
import type {
  CoachNutritionResponse,
  CoachNutritionRosterResponse,
  NutritionCalculationCreatedResponse,
  NutritionCalculationListResponse,
  NutritionCalculationResponse,
  NutritionProfileGetResponse,
  NutritionProfileResponse,
  NutritionTargetResponse,
} from '@repo/shared-types';
import type {
  NutritionManualTargetInput,
  NutritionProfileInput,
} from '@repo/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import { ageInTimeZone } from './nutrition-age.js';
import {
  mealCountFromBand,
  nutritionActivityFromDailyActivity,
  nutritionGoalFromMainGoal,
  nutritionGoalFromTrainingGoal,
} from './nutrition-from-onboarding.js';
import {
  calculateNutrition,
  NutritionInputError,
  type NutritionActivity,
  type NutritionFrequency,
  type NutritionGoal,
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

  async listRoster(now: Date): Promise<CoachNutritionRosterResponse> {
    const users = await this.prisma.user.findMany({
      where: { role: 'CLIENT' },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        email: true,
        isActive: true,
        profile: {
          select: {
            name: true,
            dateOfBirth: true,
            biologicalSexForCalculation: true,
            heightCm: true,
            activityLevel: true,
            goal: true,
            timezone: true,
          },
        },
        onboardingResponses: {
          select: { trainingFrequency: true, mainGoal: true },
        },
        nutritionProfile: { select: { activity: true, goal: true } },
        nutritionTargets: {
          where: { active: true },
          take: 1,
          select: {
            source: true,
            targetCalories: true,
            proteinGrams: true,
            fatGrams: true,
            carbsGrams: true,
          },
        },
        bodyMeasurements: {
          orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { weightKg: true },
        },
      },
    });
    return { clients: users.map((user) => toRoster(user, now)) };
  }

  async getForCoach(userId: string): Promise<CoachNutritionResponse> {
    await this.assertClient(userId);
    const [calculation, target] = await Promise.all([
      this.prisma.nutritionCalculation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.nutritionTarget.findFirst({
        where: { userId, active: true },
      }),
    ]);
    return {
      calculation: calculation ? toCalculation(calculation) : null,
      target: target ? toTarget(target) : null,
    };
  }

  async setManualTarget(
    userId: string,
    input: NutritionManualTargetInput,
  ): Promise<NutritionTargetResponse> {
    await this.assertClient(userId);
    return this.prisma.$transaction(async (db) => {
      await this.lockClient(db, userId);
      const active = await db.nutritionTarget.findFirst({
        where: { userId, active: true },
      });
      if (active) {
        await db.nutritionTarget.update({
          where: { id: active.id },
          data: { active: false },
        });
      }
      const created = await db.nutritionTarget.create({
        data: {
          userId,
          active: true,
          source: 'MANUAL',
          calculationId: null,
          targetCalories: new Prisma.Decimal(input.targetCalories),
          proteinGrams: new Prisma.Decimal(input.proteinGrams),
          fatGrams: new Prisma.Decimal(input.fatGrams),
          carbsGrams: new Prisma.Decimal(input.carbsGrams),
        },
      });
      return toTarget(created);
    });
  }

  async applyCalculation(
    userId: string,
    calculationId: string,
  ): Promise<NutritionTargetResponse> {
    await this.assertClient(userId);
    return this.prisma.$transaction(async (db) => {
      await this.lockClient(db, userId);
      const calculation = await db.nutritionCalculation.findFirst({
        where: { id: calculationId, userId },
      });
      if (!calculation) {
        throw new NotFoundException({
          code: 'NUTRITION_CALCULATION_NOT_FOUND',
          message: 'Calculation not found',
        });
      }
      const active = await db.nutritionTarget.findFirst({
        where: { userId, active: true },
      });
      if (
        active?.source === 'CALCULATED' &&
        active.calculationId === calculation.id
      ) {
        return toTarget(active);
      }
      if (active) {
        await db.nutritionTarget.update({
          where: { id: active.id },
          data: { active: false },
        });
      }
      const created = await db.nutritionTarget.create({
        data: {
          userId,
          active: true,
          source: 'CALCULATED',
          calculationId: calculation.id,
          targetCalories: calculation.targetCalories,
          proteinGrams: calculation.proteinGrams,
          fatGrams: calculation.fatGrams,
          carbsGrams: calculation.carbsGrams,
        },
      });
      return toTarget(created);
    });
  }

  async listCalculations(
    userId: string,
  ): Promise<NutritionCalculationListResponse> {
    await this.assertClient(userId);
    const [rows, target] = await Promise.all([
      this.prisma.nutritionCalculation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.nutritionTarget.findFirst({
        where: { userId, active: true },
      }),
    ]);
    return {
      calculations: rows.map(toCalculation),
      target: target ? toTarget(target) : null,
    };
  }

  async calculate(
    userId: string,
    now = new Date(),
  ): Promise<NutritionCalculationCreatedResponse> {
    await this.assertClient(userId);
    const inputs = await this.calculationInputs(userId, now);

    return this.prisma.$transaction(async (db) => {
      await this.lockClient(db, userId);
      const measured = await db.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
      });
      if (!measured) throw unsupported('Nutrition inputs are incomplete');
      const weightKg = measured.weightKg;
      const result = calculateOrReject({ ...inputs, weightKg });
      const already = await db.nutritionCalculation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      const active = await db.nutritionTarget.findFirst({
        where: { userId, active: true },
      });
      // Several 1 kg saves count. The baseline is the last stored calculation.
      // A manual target stays active, but the new snapshot is still stored.
      if (
        already &&
        !weightShiftedByAtLeastFiveKg(already.weightKg, weightKg)
      ) {
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

      const calculation = await db.nutritionCalculation.create({
        data: {
          userId,
          weightKg,
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

  /** Height, main goal, or weekly frequency changed. Rewrite the stored norm. */
  async replaceFromProfile(userId: string, now = new Date()) {
    await this.assertClient(userId);
    const inputs = await this.calculationInputs(userId, now, true);
    await this.prisma.$transaction(async (db) => {
      await this.lockClient(db, userId);
      const measured = await db.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
      });
      if (!measured) throw unsupported('Nutrition inputs are incomplete');
      const weightKg = measured.weightKg;
      const result = calculateOrReject({ ...inputs, weightKg });
      if (inputs.profileToCreate) {
        try {
          await db.nutritionProfile.create({
            data: { userId, ...inputs.profileToCreate },
          });
        } catch (error) {
          if (!isUniqueConflict(error)) throw error;
        }
      } else {
        await db.nutritionProfile.update({
          where: { userId },
          data: { activity: inputs.activity, goal: inputs.goal },
        });
      }
      const numbers = {
        weightKg,
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
      };
      const already = await db.nutritionCalculation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      const calculation = already
        ? await db.nutritionCalculation.update({
            where: { id: already.id },
            data: numbers,
          })
        : await db.nutritionCalculation.create({
            data: { userId, ...numbers },
          });
      const active = await db.nutritionTarget.findFirst({
        where: { userId, active: true },
      });
      if (active?.source === 'MANUAL') return;
      const targetNumbers = {
        calculationId: calculation.id,
        targetCalories: result.targetCalories,
        proteinGrams: result.proteinGrams,
        fatGrams: result.fatGrams,
        carbsGrams: result.carbsGrams,
      };
      if (active) {
        await db.nutritionTarget.update({
          where: { id: active.id },
          data: targetNumbers,
        });
      } else {
        await db.nutritionTarget.create({
          data: {
            userId,
            active: true,
            source: 'CALCULATED',
            ...targetNumbers,
          },
        });
      }
    });
  }

  /** No-op until a calculation exists. Weight saves call this after the row is stored. */
  async refreshAfterWeightChange(userId: string, now = new Date()) {
    const existing = await this.prisma.nutritionCalculation.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!existing) return;
    await this.calculate(userId, now);
  }

  private async lockClient(
    db: Pick<PrismaService, '$queryRaw'>,
    userId: string,
  ) {
    const locked = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundException({
        code: 'CLIENT_NOT_FOUND',
        message: 'Client not found',
      });
    }
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

  private async calculationInputs(
    userId: string,
    now: Date,
    fromOnboarding = false,
  ) {
    const [profile, body, measurement, onboarding] = await Promise.all([
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.onboardingResponses.findUnique({
        where: { userId },
        select: { trainingFrequency: true, mealsPerDay: true, mainGoal: true },
      }),
    ]);
    if (!body || !measurement) {
      throw unsupported('Nutrition inputs are incomplete');
    }
    const goal =
      profile && !fromOnboarding
        ? profile.goal
        : fromOnboarding && onboarding?.mainGoal
          ? nutritionGoalFromMainGoal(onboarding.mainGoal)
          : nutritionGoalFromTrainingGoal(body.goal, onboarding?.mainGoal);
    try {
      const activity =
        profile && !fromOnboarding
          ? profile.activity
          : nutritionActivityFromDailyActivity(body.activityLevel);
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

const WEIGHT_SHIFT_KG = new Prisma.Decimal(5);

function weightShiftedByAtLeastFiveKg(
  storedKg: Prisma.Decimal,
  currentKg: Prisma.Decimal,
) {
  return currentKg.minus(storedKg).abs().greaterThanOrEqualTo(WEIGHT_SHIFT_KG);
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

function toRoster(
  user: {
    id: string;
    email: string;
    isActive: boolean;
    profile: {
      name: string | null;
      dateOfBirth: Date;
      biologicalSexForCalculation: 'FEMALE' | 'MALE';
      heightCm: Prisma.Decimal;
      activityLevel: Parameters<typeof nutritionActivityFromDailyActivity>[0];
      goal: Parameters<typeof nutritionGoalFromTrainingGoal>[0];
      timezone: string;
    } | null;
    onboardingResponses: {
      trainingFrequency: string;
      mainGoal?: string | null;
    } | null;
    nutritionProfile: {
      activity: NutritionActivity;
      goal: NutritionGoal;
    } | null;
    nutritionTargets: {
      source: 'CALCULATED' | 'MANUAL';
      targetCalories: Prisma.Decimal;
      proteinGrams: Prisma.Decimal;
      fatGrams: Prisma.Decimal;
      carbsGrams: Prisma.Decimal;
    }[];
    bodyMeasurements: { weightKg: Prisma.Decimal }[];
  },
  now: Date,
): CoachNutritionRosterResponse['clients'][number] {
  const target = user.nutritionTargets[0] ?? null;
  const profile = user.profile;
  const activity = profile ? formulaActivity(user) : null;
  return {
    id: user.id,
    email: user.email,
    name: profile?.name ?? null,
    archived: !user.isActive,
    target: target
      ? {
          source: target.source,
          targetCalories: decimal(target.targetCalories),
          proteinGrams: decimal(target.proteinGrams),
          fatGrams: decimal(target.fatGrams),
          carbsGrams: decimal(target.carbsGrams),
        }
      : null,
    inputs: profile
      ? {
          sex: profile.biologicalSexForCalculation,
          ageYears: ageYearsOf(profile.dateOfBirth, profile.timezone, now),
          heightCm: decimal(profile.heightCm),
          weightKg: user.bodyMeasurements[0]
            ? decimal(user.bodyMeasurements[0].weightKg)
            : null,
          activity,
          frequency: user.onboardingResponses?.trainingFrequency ?? null,
          goal: user.nutritionProfile
            ? user.nutritionProfile.goal
            : nutritionGoalFromTrainingGoal(
                profile.goal,
                user.onboardingResponses?.mainGoal,
              ),
        }
      : null,
  };
}

function formulaActivity(user: {
  nutritionProfile: { activity: NutritionActivity } | null;
  profile: {
    activityLevel: Parameters<typeof nutritionActivityFromDailyActivity>[0];
  } | null;
}): NutritionActivity | null {
  if (!user.profile) return null;
  if (user.nutritionProfile) return user.nutritionProfile.activity;
  try {
    return nutritionActivityFromDailyActivity(user.profile.activityLevel);
  } catch (error) {
    if (error instanceof NutritionInputError) return null;
    throw error;
  }
}

function ageYearsOf(dateOfBirth: Date, timeZone: string, now: Date) {
  try {
    return ageInTimeZone(dateOfBirth, timeZone, now);
  } catch (error) {
    if (error instanceof NutritionInputError) return null;
    throw error;
  }
}

function toTarget(row: {
  id: string;
  source: NutritionTargetResponse['source'];
  calculationId: string | null;
  targetCalories: Prisma.Decimal;
  proteinGrams: Prisma.Decimal;
  fatGrams: Prisma.Decimal;
  carbsGrams: Prisma.Decimal;
}): NutritionTargetResponse {
  return {
    id: row.id,
    source: row.source,
    calculationId: row.calculationId,
    targetCalories: decimal(row.targetCalories),
    proteinGrams: decimal(row.proteinGrams),
    fatGrams: decimal(row.fatGrams),
    carbsGrams: decimal(row.carbsGrams),
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
