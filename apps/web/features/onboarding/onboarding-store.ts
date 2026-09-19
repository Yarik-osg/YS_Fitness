'use client';

import type {
  ActivityLevel,
  BiologicalSexForCalculation,
  WeightGoal,
} from '@repo/shared-types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ProgramTrack = 'female' | 'male';

export interface OnboardingDraft {
  programTrack?: ProgramTrack;
  // Design-reference answers below shape the eventual program preview only.
  // They intentionally are not mapped to unrelated UserProfile columns.
  currentBody?: string;
  desiredBody?: string;
  mainGoal?: string;
  experience?: string;
  trainingFrequency?: string;
  focusAreas: string[];
  nutritionCurrent?: string;
  mealsPerDay?: string;
  eatingHabits: string[];
  // Backend-supported profile inputs.
  goal?: WeightGoal;
  activityLevel?: ActivityLevel;
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  biologicalSexForCalculation?: BiologicalSexForCalculation;
}

export interface OnboardingState extends OnboardingDraft {
  step: number;
  setAnswer: (patch: Partial<OnboardingDraft>) => void;
  setStep: (step: number) => void;
  reset: () => void;
}

const initialState: OnboardingDraft & { step: number } = {
  step: 0,
  focusAreas: [],
  eatingHabits: [],
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setAnswer: (patch) => set(patch),
      setStep: (step) => set({ step }),
      reset: () => set(initialState),
    }),
    {
      name: 'ys-onboarding-draft',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        step: state.step,
        programTrack: state.programTrack,
        currentBody: state.currentBody,
        desiredBody: state.desiredBody,
        mainGoal: state.mainGoal,
        experience: state.experience,
        trainingFrequency: state.trainingFrequency,
        focusAreas: state.focusAreas,
        nutritionCurrent: state.nutritionCurrent,
        mealsPerDay: state.mealsPerDay,
        eatingHabits: state.eatingHabits,
        goal: state.goal,
        activityLevel: state.activityLevel,
        dateOfBirth: state.dateOfBirth,
        heightCm: state.heightCm,
        weightKg: state.weightKg,
        biologicalSexForCalculation: state.biologicalSexForCalculation,
      }),
    },
  ),
);
