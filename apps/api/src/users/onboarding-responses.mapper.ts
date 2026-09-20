import type {
  OnboardingMainGoal as PrismaMainGoal,
  NutritionCurrent as PrismaNutritionCurrent,
  OnboardingResponses,
  ProgramTrack as PrismaProgramTrack,
  TrainingExperience as PrismaExperience,
} from '@prisma/client';
import type {
  OnboardingMainGoal,
  NutritionCurrent,
  OnboardingResponsesRecord,
  ProgramTrack,
  TrainingExperience,
  TrainingFrequency,
} from '@repo/shared-types';
import type { OnboardingInput } from '@repo/validation';

const PROGRAM_TRACK_TO_PRISMA = {
  female: 'FEMALE',
  male: 'MALE',
} as const satisfies Record<ProgramTrack, PrismaProgramTrack>;

const PROGRAM_TRACK_FROM_PRISMA = {
  FEMALE: 'female',
  MALE: 'male',
} as const satisfies Record<PrismaProgramTrack, ProgramTrack>;

const MAIN_GOAL_TO_PRISMA = {
  lose_weight: 'LOSE_WEIGHT',
  build_muscle: 'BUILD_MUSCLE',
  improve_body: 'IMPROVE_BODY',
  maintain: 'MAINTAIN',
  get_stronger: 'GET_STRONGER',
} as const satisfies Record<OnboardingInput['mainGoal'], PrismaMainGoal>;

const MAIN_GOAL_FROM_PRISMA = {
  LOSE_WEIGHT: 'lose_weight',
  BUILD_MUSCLE: 'build_muscle',
  IMPROVE_BODY: 'improve_body',
  MAINTAIN: 'maintain',
  GET_STRONGER: 'get_stronger',
} as const satisfies Record<PrismaMainGoal, OnboardingMainGoal>;

const EXPERIENCE_TO_PRISMA = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
} as const satisfies Record<OnboardingInput['experience'], PrismaExperience>;

const EXPERIENCE_FROM_PRISMA = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const satisfies Record<PrismaExperience, TrainingExperience>;

const NUTRITION_TO_PRISMA = {
  structured: 'STRUCTURED',
  balanced: 'BALANCED',
  intuitive: 'INTUITIVE',
  irregular: 'IRREGULAR',
  uncontrolled: 'UNCONTROLLED',
} as const satisfies Record<
  OnboardingInput['nutritionCurrent'],
  PrismaNutritionCurrent
>;

const NUTRITION_FROM_PRISMA = {
  STRUCTURED: 'structured',
  BALANCED: 'balanced',
  INTUITIVE: 'intuitive',
  IRREGULAR: 'irregular',
  UNCONTROLLED: 'uncontrolled',
} as const satisfies Record<PrismaNutritionCurrent, NutritionCurrent>;

export function toPrismaOnboardingResponses(input: OnboardingInput) {
  return {
    programTrack: PROGRAM_TRACK_TO_PRISMA[input.programTrack],
    currentBody: input.currentBody,
    desiredBody: input.desiredBody,
    mainGoal: MAIN_GOAL_TO_PRISMA[input.mainGoal],
    experience: EXPERIENCE_TO_PRISMA[input.experience],
    trainingFrequency: input.trainingFrequency,
    focusAreas: input.focusAreas,
    nutritionCurrent: NUTRITION_TO_PRISMA[input.nutritionCurrent],
    mealsPerDay: input.mealsPerDay,
    eatingHabits: input.eatingHabits,
  };
}

export function sameOnboardingResponses(
  existing: OnboardingResponses,
  input: OnboardingInput,
): boolean {
  const next = toPrismaOnboardingResponses(input);
  return (
    existing.programTrack === next.programTrack &&
    existing.currentBody === next.currentBody &&
    existing.desiredBody === next.desiredBody &&
    existing.mainGoal === next.mainGoal &&
    existing.experience === next.experience &&
    existing.trainingFrequency === next.trainingFrequency &&
    existing.nutritionCurrent === next.nutritionCurrent &&
    existing.mealsPerDay === next.mealsPerDay &&
    sameStringArray(existing.focusAreas, next.focusAreas) &&
    sameStringArray(existing.eatingHabits, next.eatingHabits)
  );
}

export function toOnboardingResponsesRecord(
  row: OnboardingResponses,
): OnboardingResponsesRecord {
  return {
    programTrack: PROGRAM_TRACK_FROM_PRISMA[row.programTrack],
    currentBody: row.currentBody,
    desiredBody: row.desiredBody,
    mainGoal: MAIN_GOAL_FROM_PRISMA[row.mainGoal],
    experience: EXPERIENCE_FROM_PRISMA[row.experience],
    trainingFrequency: row.trainingFrequency as TrainingFrequency,
    focusAreas: row.focusAreas,
    nutritionCurrent: NUTRITION_FROM_PRISMA[row.nutritionCurrent],
    mealsPerDay: row.mealsPerDay,
    eatingHabits: row.eatingHabits,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sameStringArray(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
