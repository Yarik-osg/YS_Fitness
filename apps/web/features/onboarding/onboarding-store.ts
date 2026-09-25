'use client';

import type {
  ActivityLevel,
  BiologicalSexForCalculation,
  WeightGoal,
} from '@repo/shared-types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  biologicalSexFromProgramTrack,
  ONBOARDING_WIZARD_STEPS,
  type ProgramTrack,
} from './program-track';

export type { ProgramTrack };

export interface OnboardingDraft {
  programTrack?: ProgramTrack;
  // Design-reference answers below shape the eventual program preview only.
  // They intentionally are not mapped to unrelated UserProfile columns.
  currentBody?: string;
  desiredBody?: string;
  physiqueLevel?: string;
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
  ownerUserId?: string;
  setAnswer: (patch: Partial<OnboardingDraft>) => void;
  setStep: (step: number) => void;
  reset: () => void;
}

const initialState: OnboardingDraft & { step: number; ownerUserId?: string } = {
  step: 0,
  ownerUserId: undefined,
  programTrack: undefined,
  currentBody: undefined,
  desiredBody: undefined,
  physiqueLevel: undefined,
  mainGoal: undefined,
  experience: undefined,
  trainingFrequency: undefined,
  focusAreas: [],
  nutritionCurrent: undefined,
  mealsPerDay: undefined,
  eatingHabits: [],
  goal: undefined,
  activityLevel: undefined,
  dateOfBirth: undefined,
  heightCm: undefined,
  weightKg: undefined,
  biologicalSexForCalculation: undefined,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setAnswer: (patch) => set(patch),
      setStep: (step) => set({ step }),
      reset: () => set((state) => ({ ...state, ...initialState })),
    }),
    {
      name: 'ys-onboarding-draft',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        step: state.step,
        ownerUserId: state.ownerUserId,
        programTrack: state.programTrack,
        currentBody: state.currentBody,
        desiredBody: state.desiredBody,
        physiqueLevel: state.physiqueLevel,
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
      merge: (persisted, current) =>
        migrateOnboardingDraft(
          persisted as Partial<OnboardingState> | undefined,
          current,
        ),
    },
  ),
);

function migrateOnboardingDraft(
  persisted: Partial<OnboardingState> | undefined,
  current: OnboardingState,
): OnboardingState {
  const next = { ...current, ...persisted };
  const lastStep = ONBOARDING_WIZARD_STEPS - 1;

  if (typeof next.step === 'number' && next.step > lastStep) {
    next.step = lastStep;
  }

  if (next.programTrack && !next.biologicalSexForCalculation) {
    next.biologicalSexForCalculation = biologicalSexFromProgramTrack(
      next.programTrack,
    );
  }

  return next;
}

export function resetOnboardingDraft() {
  useOnboardingStore.getState().reset();
  void useOnboardingStore.persist.clearStorage();
}

export function bindOnboardingDraftToUser(
  userId: string,
  options: { replace?: boolean; claimGuest?: boolean } = {},
) {
  const apply = () => {
    const state = useOnboardingStore.getState();
    const ownedByOther = Boolean(
      state.ownerUserId && state.ownerUserId !== userId,
    );
    const unowned = !state.ownerUserId;
    if (options.replace || ownedByOther || (unowned && !options.claimGuest)) {
      resetOnboardingDraft();
    }
    useOnboardingStore.setState({ ownerUserId: userId });
  };

  if (useOnboardingStore.persist.hasHydrated()) {
    apply();
    return;
  }

  useOnboardingStore.persist.onFinishHydration(apply);
}
