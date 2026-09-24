import { describe, expect, it } from 'vitest';
import { buildOnboardingPayload } from './payload';

const femaleDraft = {
  programTrack: 'female' as const,
  currentBody: 'slim',
  desiredBody: '1',
  physiqueLevel: '4',
  mainGoal: 'get_stronger',
  experience: 'intermediate',
  trainingFrequency: '3',
  focusAreas: ['glutes', 'legs'],
  nutritionCurrent: 'balanced',
  mealsPerDay: '3',
  eatingHabits: ['snacking', 'emotional'],
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
      dateOfBirth: '1994-05-10',
      biologicalSexForCalculation: 'FEMALE',
      heightCm: 168,
      weightKg: 64.5,
      activityLevel: 'MODERATELY_ACTIVE',
      goal: 'MAINTAIN_WEIGHT',
      timezone: 'Europe/Kyiv',
      programTrack: 'female',
      currentBody: 'slim',
      desiredBody: '1',
      physiqueLevel: '4',
      mainGoal: 'get_stronger',
      experience: 'intermediate',
      trainingFrequency: '3',
      focusAreas: ['glutes', 'legs'],
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
        focusAreas: ['chest', 'abs'],
        nutritionCurrent: 'structured',
        mealsPerDay: '4-5',
        eatingHabits: ['late_eating'],
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
    expect(payload.focusAreas).toEqual(['chest', 'abs']);
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
});
