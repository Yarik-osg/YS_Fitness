import type { OnboardingInput } from '@repo/validation';

export const FEMALE_ONBOARDING = {
  name: 'Olena',
  dateOfBirth: '1990-05-10',
  biologicalSexForCalculation: 'FEMALE',
  heightCm: 168,
  weightKg: 67.5,
  bodyFatPercent: 24,
  activityLevel: 'MODERATELY_ACTIVE',
  goal: 'LOSE_WEIGHT',
  healthRestrictions: [{ type: 'knee_injury' }],
  timezone: 'Europe/Kyiv',
  programTrack: 'female',
  currentBody: '0',
  desiredBody: '1',
  mainGoal: 'get_stronger',
  experience: 'intermediate',
  trainingFrequency: '3',
  focusAreas: ['glutes'],
  nutritionCurrent: 'balanced',
  mealsPerDay: '3',
  eatingHabits: ['snacking', 'emotional'],
  physiqueLevel: '4',
} satisfies OnboardingInput;

export const FEMALE_ONBOARDING_ANSWERS = {
  programTrack: FEMALE_ONBOARDING.programTrack,
  currentBody: FEMALE_ONBOARDING.currentBody,
  desiredBody: FEMALE_ONBOARDING.desiredBody,
  mainGoal: FEMALE_ONBOARDING.mainGoal,
  experience: FEMALE_ONBOARDING.experience,
  trainingFrequency: FEMALE_ONBOARDING.trainingFrequency,
  focusAreas: FEMALE_ONBOARDING.focusAreas,
  nutritionCurrent: FEMALE_ONBOARDING.nutritionCurrent,
  mealsPerDay: FEMALE_ONBOARDING.mealsPerDay,
  eatingHabits: FEMALE_ONBOARDING.eatingHabits,
  physiqueLevel: FEMALE_ONBOARDING.physiqueLevel,
};
