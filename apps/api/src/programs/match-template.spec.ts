import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  parseProgramCsv,
  type ParsedProgramFile,
} from '../../prisma/parse-program-csv.js';
import { matchProgramTemplate } from './match-template.js';

const experiences = ['beginner', 'intermediate', 'advanced'] as const;
const frequencies = ['2', '3', '4'] as const;
const accents = {
  glutes: 'LOWER',
  legs: 'LOWER',
  shoulders: 'UPPER',
  back: 'UPPER',
  arms: 'UPPER',
  chest: 'UPPER',
  abs: 'NONE',
  full_body: 'NONE',
} as const;

const LEVEL_LETTER = {
  BEGINNER: 'B',
  INTERMEDIATE: 'M',
  ADVANCED: 'P',
} as const;

const ACCENT_LETTER = {
  NONE: '',
  UPPER: 'U',
  LOWER: 'L',
} as const;

describe('matchProgramTemplate', () => {
  let programs: ParsedProgramFile;

  beforeAll(async () => {
    const csvPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../prisma/seed-data/Ys_women.csv',
    );
    programs = parseProgramCsv(await readFile(csvPath, 'utf8'));
  });

  it.each(experiences)('maps %s experience', (experience) => {
    expect(
      matchProgramTemplate({
        programTrack: 'female',
        experience,
        trainingFrequency: '3',
        focusArea: 'abs',
      }),
    ).toEqual({
      gender: 'FEMALE',
      level: experience.toUpperCase(),
      frequencyPerWeek: 3,
      accent: 'NONE',
    });
  });

  it.each(frequencies)('maps %s sessions a week', (trainingFrequency) => {
    expect(
      matchProgramTemplate({
        programTrack: 'female',
        experience: 'beginner',
        trainingFrequency,
        focusArea: 'full_body',
      })?.frequencyPerWeek,
    ).toBe(Number(trainingFrequency));
  });

  it.each(Object.entries(accents))('maps %s to %s', (focusArea, accent) => {
    expect(
      matchProgramTemplate({
        programTrack: 'female',
        experience: 'advanced',
        trainingFrequency: '4',
        focusArea,
      })?.accent,
    ).toBe(accent);
  });

  it.each(
    experiences.flatMap((experience) =>
      frequencies.flatMap((trainingFrequency) =>
        Object.keys(accents).map((focusArea) => ({
          experience,
          trainingFrequency,
          focusArea,
        })),
      ),
    ),
  )(
    'selects the female template for $experience / $trainingFrequency / $focusArea',
    ({ experience, trainingFrequency, focusArea }) => {
      const match = matchProgramTemplate({
        programTrack: 'female',
        experience,
        trainingFrequency,
        focusArea,
      });
      expect(match).not.toBeNull();
      if (!match) return;
      const code = `W${LEVEL_LETTER[match.level]}${match.frequencyPerWeek}${ACCENT_LETTER[match.accent]}`;
      expect(
        programs.templates.find((template) => template.code === code),
      ).toMatchObject(match);
      if (
        experience === 'beginner' &&
        trainingFrequency === '2' &&
        focusArea === 'shoulders'
      ) {
        expect(code).toBe('WB2U');
      }
    },
  );

  it('returns no match for the male track', () => {
    expect(
      matchProgramTemplate({
        programTrack: 'male',
        experience: 'beginner',
        trainingFrequency: '2',
        focusArea: 'glutes',
      }),
    ).toBeNull();
  });
});
