import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mergeProgramFiles } from './merge-program-files.js';
import { parseProgramCsv } from './parse-program-csv.js';

const directory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed-data',
);

describe('mergeProgramFiles', () => {
  it('keeps the female identity and the male template prescription', async () => {
    const women = parseProgramCsv(
      await readFile(path.join(directory, 'Ys_women.csv'), 'utf8'),
    );
    const men = parseProgramCsv(
      await readFile(path.join(directory, 'Ys_men.csv'), 'utf8'),
    );
    const merged = mergeProgramFiles([women, men]);
    const again = mergeProgramFiles([women, men]);

    expect(
      merged.exercises.find((exercise) => exercise.code === 'EX_008'),
    ).toMatchObject({
      name: 'Жим гантелей вгору сидячи',
      nameEn: 'Seated dumbbell shoulder press',
      repsMin: 10,
      repsMax: 12,
    });
    expect(
      merged.exercises.find((exercise) => exercise.code === 'EX_010'),
    ).toMatchObject({
      name: 'Жим у Сміті 30°',
      nameEn: '30° Smith machine bench press',
    });
    expect(merged.exercises).toHaveLength(64);
    expect(merged.templates).toHaveLength(81);
    expect(
      merged.templates.filter((template) => template.gender === 'FEMALE'),
    ).toHaveLength(27);
    expect(
      merged.templates.filter((template) => template.gender === 'MALE'),
    ).toHaveLength(54);

    const maleRow = merged.templates
      .find((template) => template.code === 'MB2')
      ?.days[1]?.exercises.find((row) => row.exerciseCode === 'EX_008');
    expect(maleRow).toMatchObject({ repsMin: 8, repsMax: 12 });

    const femaleRow = merged.templates
      .find((template) => template.code === 'WB2')
      ?.days[0]?.exercises.find((row) => row.exerciseCode === 'EX_008');
    expect(femaleRow).toMatchObject({ repsMin: 10, repsMax: 12 });
    expect(again).toEqual(merged);
  });
});
