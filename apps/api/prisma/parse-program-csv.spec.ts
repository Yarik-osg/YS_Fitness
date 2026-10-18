import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProgramCsv } from './parse-program-csv.js';

const csvPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed-data',
  'Ys_women.csv',
);

describe('parseProgramCsv', () => {
  it('reads sets, rep ranges, and the abs add-on from the female file', async () => {
    const parsed = parseProgramCsv(await readFile(csvPath, 'utf8'));

    expect(parsed.exercises).toHaveLength(44);
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_033'),
    ).toEqual({
      code: 'EX_033',
      name: 'Румунська тяга з гантелями',
      nameEn: 'Dumbbell Romanian deadlift',
      muscleGroups: ['HAMSTRINGS', 'GLUTES'],
      repsMin: 10,
      repsMax: 12,
    });

    const template = parsed.templates.find((item) => item.code === 'WB2U');
    expect(template).toMatchObject({
      name: 'WB2U — Жінки · Початковий рівень · 2 тренування на тиждень · Акцент на верх',
      gender: 'FEMALE',
      level: 'BEGINNER',
      frequencyPerWeek: 2,
      accent: 'UPPER',
    });
    expect(template?.days).toHaveLength(2);
    expect(template?.days[0]?.exercises).toEqual([
      {
        exerciseCode: 'EX_039',
        name: 'Тяга вертикального блоку',
        order: 1,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_008',
        name: 'Жим гантелей вгору сидячи',
        order: 2,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_041',
        name: 'Тяга горизонтального блоку',
        order: 3,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_015',
        name: 'Згинання рук з гантелями',
        order: 4,
        sets: 2,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_037',
        name: 'Сідничний міст у тренажері',
        order: 5,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_033',
        name: 'Румунська тяга з гантелями',
        order: 6,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: true,
      },
    ]);
    expect(template?.days[1]?.exercises).toEqual([
      {
        exerciseCode: 'EX_009',
        name: 'Жим гантелей на похилій лавці 30°',
        order: 1,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_039',
        name: 'Тяга вертикального блоку',
        order: 2,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_018',
        name: 'Махи гантелями сидячи',
        order: 3,
        sets: 3,
        repsMin: 12,
        repsMax: 15,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_031',
        name: 'Розгинання рук із канатним руків’ям',
        order: 4,
        sets: 2,
        repsMin: 12,
        repsMax: 15,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_021',
        name: 'Присідання з гирею',
        order: 5,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_003',
        name: 'Випади назад з гантелями',
        order: 6,
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        allowsAbsAddon: false,
      },
    ]);

    expect(parsed.templates).toHaveLength(27);
    for (const program of parsed.templates) {
      expect(program.days.map((day) => day.dayNumber)).toEqual(
        Array.from(
          { length: program.frequencyPerWeek },
          (_, index) => index + 1,
        ),
      );
    }
  });

  it('rejects a template whose code disagrees with its subtitle', () => {
    const source = [
      'WB2: Таблиця 1',
      'WB2 — Жінки · Просунутий рівень · 2 тренування на тиждень · Без акценту',
      ';;;;;;',
      'День;№;Вправа;М’язова група;ID вправи;Підходи;',
      'День 1;1;Присідання;Сідниці;EX_001;3;',
      'День 2;1;Присідання;Сідниці;EX_001;3;',
      '',
      'Список вправ: Таблиця 1',
      'Назва вправи;М’язова група;ID вправи;Повторення;Назва англійською;',
      'Присідання;Сідниці;EX_001;10-12;Squat;',
    ].join('\n');

    expect(() => parseProgramCsv(source)).toThrow(
      /WB2 disagrees with its subtitle/,
    );
  });

  it('rejects a template whose days do not match its weekly frequency', () => {
    const source = [
      'WB2: Таблиця 1',
      'WB2 — Жінки · Початковий рівень · 2 тренування на тиждень · Без акценту',
      ';;;;;;',
      'День;№;Вправа;М’язова група;ID вправи;Підходи;',
      'День 1;1;Присідання;Сідниці;EX_001;3;',
      '',
      'Список вправ: Таблиця 1',
      'Назва вправи;М’язова група;ID вправи;Повторення;Назва англійською;',
      'Присідання;Сідниці;EX_001;10-12;Squat;',
    ].join('\n');

    expect(() => parseProgramCsv(source)).toThrow(
      /WB2 lists days 1 but its frequency is 2/,
    );
  });

  it('rejects an abs add-on that is not the last exercise of the day', () => {
    const source = [
      'WB2: Таблиця 1',
      'WB2 — Жінки · Початковий рівень · 2 тренування на тиждень · Без акценту',
      ';;;;;;',
      'День;№;Вправа;М’язова група;ID вправи;Підходи;',
      'День 1;1;Присідання;Сідниці;EX_001;3;Прес+',
      'День 1;2;Присідання;Сідниці;EX_001;3;',
      'День 2;1;Присідання;Сідниці;EX_001;3;',
      '',
      'Список вправ: Таблиця 1',
      'Назва вправи;М’язова група;ID вправи;Повторення;Назва англійською;',
      'Присідання;Сідниці;EX_001;10-12;Squat;',
    ].join('\n');

    expect(() => parseProgramCsv(source)).toThrow(
      /WB2 day 1 marks an abs add-on on order 1, which is not the last exercise/,
    );
  });

  it('rejects a repeated exercise order on the same day', () => {
    const source = [
      'WB2: Таблиця 1',
      'WB2 — Жінки · Початковий рівень · 2 тренування на тиждень · Без акценту',
      ';;;;;;',
      'День;№;Вправа;М’язова група;ID вправи;Підходи;',
      'День 1;1;Присідання;Сідниці;EX_001;3;',
      'День 1;1;Присідання;Сідниці;EX_001;3;',
      'День 2;1;Присідання;Сідниці;EX_001;3;',
      '',
      'Список вправ: Таблиця 1',
      'Назва вправи;М’язова група;ID вправи;Повторення;Назва англійською;',
      'Присідання;Сідниці;EX_001;10-12;Squat;',
    ].join('\n');

    expect(() => parseProgramCsv(source)).toThrow(
      /WB2 day 1 repeats an exercise order/,
    );
  });

  it('rejects a library exercise without an English name', () => {
    const source = [
      'WB2: Таблиця 1',
      'WB2 — Жінки · Початковий рівень · 2 тренування на тиждень · Без акценту',
      ';;;;;;',
      'День;№;Вправа;М’язова група;ID вправи;Підходи;',
      'День 1;1;Присідання;Сідниці;EX_001;3;',
      'День 2;1;Присідання;Сідниці;EX_001;3;',
      '',
      'Список вправ: Таблиця 1',
      'Назва вправи;М’язова група;ID вправи;Повторення;Назва англійською;',
      'Присідання;Сідниці;EX_001;10-12;',
    ].join('\n');

    expect(() => parseProgramCsv(source)).toThrow(
      /Exercise library row is incomplete/,
    );
  });

  it('gives every exercise in the female file a distinct English name', async () => {
    const parsed = parseProgramCsv(await readFile(csvPath, 'utf8'));
    const names = parsed.exercises.map((exercise) => exercise.nameEn);

    expect(names.every((name) => name.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});

const menCsvPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed-data',
  'Ys_men.csv',
);

describe('parseProgramCsv male file', () => {
  it('keeps the first catalog row and reads every male template', async () => {
    const parsed = parseProgramCsv(await readFile(menCsvPath, 'utf8'));
    const codes = parsed.exercises.map((exercise) => exercise.code);

    expect(parsed.exercises).toHaveLength(64);
    expect(new Set(codes).size).toBe(64);
    expect(codes).toContain('EX_064');
    expect(codes).not.toContain('EX_058');
    expect(parsed.templates).toHaveLength(54);
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_008'),
    ).toMatchObject({
      repsMin: 8,
      repsMax: 12,
      nameEn: 'Seated dumbbell shoulder press',
    });
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_009'),
    ).toMatchObject({ repsMin: 8, repsMax: 12 });
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_011'),
    ).toMatchObject({ repsMin: 8, repsMax: 12 });
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_013'),
    ).toMatchObject({ repsMin: 10, repsMax: 12 });
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_025'),
    ).toMatchObject({ repsMin: 10, repsMax: 15 });
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_041'),
    ).toMatchObject({ repsMin: 9, repsMax: 12 });
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_055'),
    ).toMatchObject({
      muscleGroups: ['SHOULDERS', 'REAR_DELTOIDS'],
      nameEn: 'Face pull',
    });
    expect(
      parsed.exercises.find((exercise) => exercise.code === 'EX_059'),
    ).toMatchObject({
      muscleGroups: ['CALVES'],
      nameEn: 'Standing calf raise',
    });

    const maleOnly = parsed.exercises.filter((exercise) => {
      const number = Number(exercise.code.slice(3));
      return number >= 45;
    });
    expect(maleOnly).toHaveLength(20);
    expect(maleOnly.every((exercise) => exercise.nameEn.length > 0)).toBe(true);

    const frequencies = { 2: 0, 3: 0, 4: 0 };
    for (const template of parsed.templates) {
      expect(template.gender).toBe('MALE');
      frequencies[template.frequencyPerWeek as 2 | 3 | 4] += 1;
      expect(template.days.map((day) => day.dayNumber)).toEqual(
        Array.from(
          { length: template.frequencyPerWeek },
          (_, index) => index + 1,
        ),
      );
      for (const day of template.days) {
        expect(day.exercises.map((row) => row.order)).toEqual(
          day.exercises.map((_, index) => index + 1),
        );
      }
    }
    expect(frequencies).toEqual({ 2: 18, 3: 18, 4: 18 });

    const beginner = parsed.templates.find(
      (template) => template.code === 'MB2',
    );
    const shoulderPress = beginner?.days[1]?.exercises.find(
      (row) => row.exerciseCode === 'EX_008',
    );
    expect(shoulderPress).toMatchObject({ repsMin: 8, repsMax: 12, sets: 3 });
  });
});

describe('parseProgramCsv errors', () => {
  it('rejects an unknown exercise reference', () => {
    expect(() =>
      parseProgramCsv(programCsv('День 1;1;Присідання;Сідниці;EX_999;3;')),
    ).toThrow(/WB2 uses unknown exercise EX_999/);
  });

  it('rejects a gap in exercise order', () => {
    expect(() =>
      parseProgramCsv(
        programCsv(
          [
            'День 1;1;Присідання;Сідниці;EX_001;3;',
            'День 1;3;Присідання;Сідниці;EX_001;3;',
          ].join('\n'),
        ),
      ),
    ).toThrow(/WB2 day 1 has exercise orders 1, 3 instead of 1\.\.2/);
  });

  it('rejects an unknown muscle group', () => {
    expect(() =>
      parseProgramCsv(
        programCsv(
          'День 1;1;Присідання;Сідниці;EX_001;3;',
          'Ікри;Ікри;EX_001;10-12;Calves;',
        ),
      ),
    ).toThrow(/EX_001 has an unknown muscle group "Ікри"/);
  });

  it('rejects a male accent letter the female track does not use', () => {
    expect(() =>
      parseProgramCsv(
        programCsv('День 1;1;Присідання;Сідниці;EX_001;3;', undefined, 'WB2B'),
      ),
    ).toThrow(/WB2B does not match the template pattern/);
  });

  it('accepts a rep range whose minimum is zero', () => {
    const parsed = parseProgramCsv(
      programCsv(
        'День 1;1;Присідання;Сідниці;EX_001;3;',
        'Присідання;Сідниці;EX_001;0-8;Squat;',
      ),
    );

    expect(parsed.exercises[0]).toMatchObject({ repsMin: 0, repsMax: 8 });
    expect(parsed.templates[0]?.days[0]?.exercises[0]).toMatchObject({
      exerciseCode: 'EX_001',
      repsMin: 0,
      repsMax: 8,
    });
  });

  it('rejects a rep range whose minimum exceeds its maximum', () => {
    expect(() =>
      parseProgramCsv(
        programCsv(
          'День 1;1;Присідання;Сідниці;EX_001;3;',
          'Присідання;Сідниці;EX_001;12-8;Squat;',
        ),
      ),
    ).toThrow(/EX_001 has a rep range whose minimum exceeds its maximum/);
  });
});

function programCsv(
  dayRows: string,
  libraryRow?: string,
  code = 'WB2',
): string {
  const frequency = code.includes('3') ? 3 : code.includes('4') ? 4 : 2;
  const days = [dayRows];
  if (!dayRows.includes('День 2') && frequency >= 2) {
    days.push('День 2;1;Присідання;Сідниці;EX_001;3;');
  }
  if (frequency >= 3) days.push('День 3;1;Присідання;Сідниці;EX_001;3;');
  if (frequency >= 4) days.push('День 4;1;Присідання;Сідниці;EX_001;3;');
  return [
    `${code}: Таблиця 1`,
    `${code} — Жінки · Початковий рівень · ${frequency} тренування на тиждень · Без акценту`,
    ';;;;;;',
    'День;№;Вправа;М’язова група;ID вправи;Підходи;',
    ...days,
    '',
    'Список вправ: Таблиця 1',
    'Назва вправи;М’язова група;ID вправи;Повторення;Назва англійською;',
    libraryRow ?? 'Присідання;Сідниці;EX_001;10-12;Squat;',
  ].join('\n');
}
