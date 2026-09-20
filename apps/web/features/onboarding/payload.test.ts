import { describe, expect, it } from 'vitest';
import { buildOnboardingPayload } from './payload';

describe('buildOnboardingPayload', () => {
  it('submits only backend-supported profile fields', () => {
    const payload = buildOnboardingPayload(
      {
        programTrack: 'female',
        currentBody: '2',
        desiredBody: '1',
        mainGoal: 'get_stronger',
        experience: 'intermediate',
        trainingFrequency: '3',
        focusAreas: ['glutes'],
        nutritionCurrent: 'balanced',
        mealsPerDay: '3',
        eatingHabits: ['snacking'],
        dateOfBirth: '1994-05-10',
        biologicalSexForCalculation: 'FEMALE',
        heightCm: 168,
        weightKg: 64.5,
        activityLevel: 'MODERATELY_ACTIVE',
        goal: 'MAINTAIN_WEIGHT',
      },
      'Europe/Kyiv',
    );

    expect(payload).toEqual({
      dateOfBirth: '1994-05-10',
      biologicalSexForCalculation: 'FEMALE',
      heightCm: 168,
      weightKg: 64.5,
      activityLevel: 'MODERATELY_ACTIVE',
      goal: 'MAINTAIN_WEIGHT',
      timezone: 'Europe/Kyiv',
    });
    expect(payload).not.toHaveProperty('programTrack');
    expect(payload).not.toHaveProperty('mainGoal');
    expect(payload).not.toHaveProperty('eatingHabits');
  });

  it('sends MALE calculation sex from a male program-track draft', () => {
    const payload = buildOnboardingPayload(
      {
        programTrack: 'male',
        dateOfBirth: '1990-01-15',
        biologicalSexForCalculation: 'MALE',
        heightCm: 180,
        weightKg: 82,
        activityLevel: 'LIGHTLY_ACTIVE',
        goal: 'GAIN_WEIGHT',
        focusAreas: ['chest'],
        eatingHabits: ['late_eating'],
      },
      'Europe/Kyiv',
    );

    expect(payload.biologicalSexForCalculation).toBe('MALE');
    expect(payload).not.toHaveProperty('programTrack');
  });

  it('derives calculation sex from program track when the draft sex is missing', () => {
    const payload = buildOnboardingPayload(
      {
        programTrack: 'female',
        dateOfBirth: '1994-05-10',
        heightCm: 168,
        weightKg: 64.5,
        activityLevel: 'MODERATELY_ACTIVE',
        goal: 'MAINTAIN_WEIGHT',
        focusAreas: [],
        eatingHabits: [],
      },
      'Europe/Kyiv',
    );

    expect(payload.biologicalSexForCalculation).toBe('FEMALE');
  });
});
