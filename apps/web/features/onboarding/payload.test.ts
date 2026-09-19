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
});
