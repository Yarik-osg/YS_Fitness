import type {
  ProgramAccent,
  ProgramTrack,
  TrainingExperience,
} from '@prisma/client';
import { FEMALE_FOCUS_AREAS, MALE_FOCUS_AREAS } from '@repo/validation';

const LEVELS = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
} as const satisfies Record<string, TrainingExperience>;

const FEMALE_ACCENTS = {
  glutes: 'LOWER',
  legs: 'LOWER',
  shoulders: 'UPPER',
  back: 'UPPER',
  arms: 'UPPER',
  chest: 'UPPER',
  abs: 'NONE',
  full_body: 'NONE',
} as const satisfies Record<string, ProgramAccent>;

const MALE_ACCENTS = {
  chest: 'CHEST',
  back: 'BACK',
  shoulders: 'SHOULDERS',
  arms: 'ARMS',
  legs: 'LEGS',
  glutes: 'LEGS',
  full_body: 'NONE',
} as const satisfies Record<string, ProgramAccent>;

export interface TemplateMatch {
  gender: ProgramTrack;
  level: TrainingExperience;
  frequencyPerWeek: number;
  accent: ProgramAccent;
}

export function matchProgramTemplate(input: {
  programTrack: 'female' | 'male';
  experience: string;
  trainingFrequency: string;
  focusArea: string | undefined;
}): TemplateMatch | null {
  const level = LEVELS[input.experience as keyof typeof LEVELS];
  const frequencyPerWeek = Number(input.trainingFrequency);
  const accent = input.focusArea
    ? input.programTrack === 'male'
      ? MALE_ACCENTS[input.focusArea as keyof typeof MALE_ACCENTS]
      : FEMALE_ACCENTS[input.focusArea as keyof typeof FEMALE_ACCENTS]
    : undefined;

  if (!level || ![2, 3, 4].includes(frequencyPerWeek) || !accent) return null;

  return {
    gender: input.programTrack === 'male' ? 'MALE' : 'FEMALE',
    level,
    frequencyPerWeek,
    accent,
  };
}

/** First onboarding focus that `matchProgramTemplate` maps to `accent`. */
export function focusAreaForAccent(
  programTrack: 'female' | 'male',
  accent: ProgramAccent,
): string | undefined {
  const table = programTrack === 'male' ? MALE_ACCENTS : FEMALE_ACCENTS;
  const allowed = new Set<string>(
    programTrack === 'male' ? MALE_FOCUS_AREAS : FEMALE_FOCUS_AREAS,
  );
  for (const [focus, mapped] of Object.entries(table)) {
    if (mapped === accent && allowed.has(focus)) return focus;
  }
  return undefined;
}
