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
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_008',
        name: 'Жим гантелей вгору сидячи',
        order: 2,
        sets: 3,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_041',
        name: 'Тяга горизонтального блоку',
        order: 3,
        sets: 3,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_015',
        name: 'Згинання рук з гантелями',
        order: 4,
        sets: 2,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_037',
        name: 'Сідничний міст у тренажері',
        order: 5,
        sets: 3,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_033',
        name: 'Румунська тяга з гантелями',
        order: 6,
        sets: 3,
        allowsAbsAddon: true,
      },
    ]);
    expect(template?.days[1]?.exercises).toEqual([
      {
        exerciseCode: 'EX_009',
        name: 'Жим гантелей на похилій лавці 30°',
        order: 1,
        sets: 3,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_039',
        name: 'Тяга вертикального блоку',
        order: 2,
        sets: 3,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_018',
        name: 'Махи гантелями сидячи',
        order: 3,
        sets: 3,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_031',
        name: 'Розгинання рук із канатним руків’ям',
        order: 4,
        sets: 2,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_021',
        name: 'Присідання з гирею',
        order: 5,
        sets: 3,
        allowsAbsAddon: false,
      },
      {
        exerciseCode: 'EX_003',
        name: 'Випади назад з гантелями',
        order: 6,
        sets: 3,
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
      'Назва вправи;М’язова група;ID вправи;Повторення;',
      'Присідання;Сідниці;EX_001;10-12;',
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
      'Назва вправи;М’язова група;ID вправи;Повторення;',
      'Присідання;Сідниці;EX_001;10-12;',
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
      'Назва вправи;М’язова група;ID вправи;Повторення;',
      'Присідання;Сідниці;EX_001;10-12;',
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
      'Назва вправи;М’язова група;ID вправи;Повторення;',
      'Присідання;Сідниці;EX_001;10-12;',
    ].join('\n');

    expect(() => parseProgramCsv(source)).toThrow(
      /WB2 day 1 repeats an exercise order/,
    );
  });
});
