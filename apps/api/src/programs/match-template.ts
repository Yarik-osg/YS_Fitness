import type {
  ProgramAccent,
  ProgramTrack,
  TrainingExperience,
} from '@prisma/client';

const LEVELS = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
} as const satisfies Record<string, TrainingExperience>;

const ACCENTS = {
  glutes: 'LOWER',
  legs: 'LOWER',
  shoulders: 'UPPER',
  back: 'UPPER',
  arms: 'UPPER',
  chest: 'UPPER',
  abs: 'NONE',
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
  if (input.programTrack !== 'female') return null;

  const level = LEVELS[input.experience as keyof typeof LEVELS];
  const frequencyPerWeek = Number(input.trainingFrequency);
  const accent = input.focusArea
    ? ACCENTS[input.focusArea as keyof typeof ACCENTS]
    : undefined;

  if (!level || ![2, 3, 4].includes(frequencyPerWeek) || !accent) return null;

  return {
    gender: 'FEMALE',
    level,
    frequencyPerWeek,
    accent,
  };
}
