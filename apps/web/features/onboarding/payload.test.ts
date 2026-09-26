import { describe, expect, it } from 'vitest';
import { buildOnboardingPayload, tryBuildOnboardingPayload } from './payload';

const femaleDraft = {
  programTrack: 'female' as const,
  currentBody: '0',
  desiredBody: '1',
  physiqueLevel: '4',
  mainGoal: 'get_stronger',
  experience: 'intermediate',
  trainingFrequency: '3',
  focusAreas: ['glutes'],
  nutritionCurrent: 'balanced',
  mealsPerDay: '3',
  eatingHabits: ['snacking', 'emotional'],
  name: 'Olena',
  dateOfBirth: '1994-05-10',
  biologicalSexForCalculation: 'FEMALE' as const,
  heightCm: 168,
  weightKg: 64.5,
  activityLevel: 'MODERATELY_ACTIVE' as const,
  goal: 'MAINTAIN_WEIGHT' as const,
};

describe('buildOnboardingPayload', () => {
  it('includes the full questionnaire draft in the submission payload', () => {
    const payload = buildOnboardingPayload(femaleDraft, 'Europe/Kyiv');

    expect(payload).toEqual({
      name: 'Olena',
      dateOfBirth: '1994-05-10',
      biologicalSexForCalculation: 'FEMALE',
      heightCm: 168,
      weightKg: 64.5,
      activityLevel: 'MODERATELY_ACTIVE',
      goal: 'MAINTAIN_WEIGHT',
      timezone: 'Europe/Kyiv',
      programTrack: 'female',
      currentBody: '0',
      desiredBody: '1',
      physiqueLevel: '4',
      mainGoal: 'get_stronger',
      experience: 'intermediate',
      trainingFrequency: '3',
      focusAreas: ['glutes'],
      nutritionCurrent: 'balanced',
      mealsPerDay: '3',
      eatingHabits: ['snacking', 'emotional'],
    });
  });

  it('sends MALE calculation sex from a male program-track draft', () => {
    const payload = buildOnboardingPayload(
      {
        programTrack: 'male',
        currentBody: '2',
        desiredBody: '3',
        physiqueLevel: '6',
        mainGoal: 'build_muscle',
        experience: 'advanced',
        trainingFrequency: '4',
        focusAreas: ['chest'],
        nutritionCurrent: 'structured',
        mealsPerDay: '4-5',
        eatingHabits: ['late_eating'],
        name: 'Andrii',
        dateOfBirth: '1990-01-15',
        biologicalSexForCalculation: 'MALE',
        heightCm: 180,
        weightKg: 82,
        activityLevel: 'LIGHTLY_ACTIVE',
        goal: 'GAIN_WEIGHT',
      },
      'Europe/Kyiv',
    );

    expect(payload.biologicalSexForCalculation).toBe('MALE');
    expect(payload.programTrack).toBe('male');
    expect(payload.physiqueLevel).toBe('6');
    expect(payload.focusAreas).toEqual(['chest']);
  });

  it('derives calculation sex from program track when the draft sex is missing', () => {
    const payload = buildOnboardingPayload(
      {
        ...femaleDraft,
        biologicalSexForCalculation: undefined,
      },
      'Europe/Kyiv',
    );

    expect(payload.biologicalSexForCalculation).toBe('FEMALE');
  });

  it('derives profile fields that the mock questionnaire no longer asks', () => {
    const payload = buildOnboardingPayload(
      {
        ...femaleDraft,
        physiqueLevel: undefined,
        activityLevel: undefined,
        goal: undefined,
      },
      'Europe/Kyiv',
    );

    expect(payload.physiqueLevel).toBe('0');
    expect(payload.activityLevel).toBe('MODERATELY_ACTIVE');
    expect(payload.goal).toBe('GAIN_WEIGHT');
  });

  it('returns null for an incomplete guest draft', () => {
    expect(
      tryBuildOnboardingPayload({
        focusAreas: [],
        eatingHabits: [],
        programTrack: 'female',
      }),
    ).toBeNull();
  });
});
