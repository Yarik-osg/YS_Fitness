export const MUSCLE_GROUPS = [
  'GLUTES',
  'QUADRICEPS',
  'HAMSTRINGS',
  'BACK',
  'BICEPS',
  'TRICEPS',
  'CHEST',
  'SHOULDERS',
  'ABS',
  'REAR_DELTOIDS',
  'CALVES',
] as const;

export type ParsedMuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type ParsedGender = 'FEMALE' | 'MALE';
export type ParsedLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type ParsedAccent =
  'NONE' | 'UPPER' | 'LOWER' | 'BACK' | 'CHEST' | 'SHOULDERS' | 'ARMS' | 'LEGS';

const MUSCLE_LABELS: Record<string, ParsedMuscleGroup> = {
  Сідниці: 'GLUTES',
  Квадрицепси: 'QUADRICEPS',
  'Задня поверхня стегна': 'HAMSTRINGS',
  Спина: 'BACK',
  Біцепс: 'BICEPS',
  Трицепс: 'TRICEPS',
  Груди: 'CHEST',
  Плечі: 'SHOULDERS',
  Прес: 'ABS',
  'Задня дельта': 'REAR_DELTOIDS',
  'Литкові м’язи': 'CALVES',
};

const LEVEL_LABELS: Record<string, ParsedLevel> = {
  'Початковий рівень': 'BEGINNER',
  'Середній рівень': 'INTERMEDIATE',
  'Просунутий рівень': 'ADVANCED',
};

const LEVEL_LETTERS: Record<string, ParsedLevel> = {
  B: 'BEGINNER',
  M: 'INTERMEDIATE',
  P: 'ADVANCED',
};

const ACCENT_LABELS: Record<string, ParsedAccent> = {
  'Без акценту': 'NONE',
  'Акцент на верх': 'UPPER',
  'Акцент на низ': 'LOWER',
  'Акцент на спину': 'BACK',
  'Акцент на груди': 'CHEST',
  'Акцент на плечі': 'SHOULDERS',
  'Акцент на руки': 'ARMS',
  'Акцент на ноги': 'LEGS',
};

const FEMALE_ACCENT_LETTERS: Record<string, ParsedAccent> = {
  '': 'NONE',
  U: 'UPPER',
  L: 'LOWER',
};

const MALE_ACCENT_LETTERS: Record<string, ParsedAccent> = {
  '': 'NONE',
  B: 'BACK',
  C: 'CHEST',
  S: 'SHOULDERS',
  A: 'ARMS',
  L: 'LEGS',
};

const GENDER_LABELS: Record<string, ParsedGender> = {
  Жінки: 'FEMALE',
  Чоловіки: 'MALE',
};

export interface ParsedExercise {
  code: string;
  name: string;
  nameEn: string;
  muscleGroups: ParsedMuscleGroup[];
  repsMin: number;
  repsMax: number;
}

export interface ParsedTemplateExercise {
  exerciseCode: string;
  name: string;
  order: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  allowsAbsAddon: boolean;
}

export interface ParsedTemplateDay {
  dayNumber: number;
  exercises: ParsedTemplateExercise[];
}

export interface ParsedTemplate {
  code: string;
  name: string;
  gender: ParsedGender;
  level: ParsedLevel;
  frequencyPerWeek: number;
  accent: ParsedAccent;
  days: ParsedTemplateDay[];
}

export interface ParsedProgramFile {
  exercises: ParsedExercise[];
  templates: ParsedTemplate[];
}

export function parseProgramCsv(source: string): ParsedProgramFile {
  const sections = splitSections(source);
  const exercises: ParsedExercise[] = [];
  const templates: ParsedTemplate[] = [];

  const programSections: string[][] = [];
  for (const section of sections) {
    const title = section[0] ?? '';
    if (title.startsWith('Список вправ')) {
      exercises.push(...parseLibrary(section));
      continue;
    }
    if (title.includes('Таблиця 1')) programSections.push(section);
  }

  if (exercises.length === 0) {
    throw new Error('Program CSV is missing the exercise library');
  }

  const library = indexExercises(exercises);
  const problems: string[] = [];
  for (const section of programSections) {
    templates.push(parseTemplate(section, library, problems));
  }
  if (problems.length > 0) {
    throw new Error(problems.join('\n'));
  }

  return { exercises, templates };
}

function splitSections(source: string): string[][] {
  const sections: string[][] = [];
  let current: string[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    if (rawLine.trim() === '') {
      if (current.length > 0) sections.push(current);
      current = [];
      continue;
    }
    current.push(rawLine);
  }
  if (current.length > 0) sections.push(current);
  return sections;
}

function isBlank(line: string): boolean {
  return line.replaceAll(';', '').trim() === '';
}

function cells(line: string): string[] {
  return line.split(';').map((cell) => cell.trim());
}

function rowsAfterHeader(lines: string[]): string[] {
  return lines.filter((line) => !isBlank(line)).slice(1);
}

function parseLibrary(section: string[]): ParsedExercise[] {
  const exercises: ParsedExercise[] = [];
  const seen = new Set<string>();

  for (const line of rowsAfterHeader(section.slice(1))) {
    const [name, muscles, code, reps, nameEn] = cells(line);
    if (!name || !code || !reps || !nameEn) {
      throw new Error(`Exercise library row is incomplete: ${line}`);
    }
    if (seen.has(code)) continue;
    seen.add(code);
    const range = parseRepRange(reps, code);
    exercises.push({
      code,
      name,
      nameEn,
      muscleGroups: parseMuscles(muscles ?? '', code),
      ...range,
    });
  }

  return exercises;
}

function parseTemplate(
  section: string[],
  library: Map<string, ParsedExercise>,
  problems: string[],
): ParsedTemplate {
  const title = section[0] ?? '';
  const code = title.split(':')[0]?.trim() ?? '';
  const subtitle = section[1] ?? '';
  const identity = parseIdentity(code, subtitle);
  const structure = new Map<
    number,
    { order: number; allowsAbsAddon: boolean }[]
  >();
  const resolved = new Map<number, ParsedTemplateExercise[]>();

  for (const line of rowsAfterHeader(section.slice(2))) {
    const [dayLabel, orderText, name, , exerciseCode, setsText, marker] =
      cells(line);
    const dayNumber = Number(dayLabel?.replace('День', '').trim());
    const order = Number(orderText);
    const sets = Number(setsText);
    if (
      !exerciseCode ||
      !name ||
      !Number.isInteger(dayNumber) ||
      !Number.isInteger(order) ||
      order < 1 ||
      !Number.isInteger(sets) ||
      sets < 1
    ) {
      throw new Error(`${code} has an unreadable exercise row: ${line}`);
    }
    const allowsAbsAddon = (marker ?? '').startsWith('Прес');
    const slots = structure.get(dayNumber) ?? [];
    slots.push({ order, allowsAbsAddon });
    structure.set(dayNumber, slots);

    const known = library.get(exerciseCode);
    if (!known) {
      problems.push(`${code} uses unknown exercise ${exerciseCode}`);
      continue;
    }
    if (known.name !== name) {
      problems.push(
        `${code} day ${dayNumber} ${exerciseCode} is named "${name}" but the library says "${known.name}"`,
      );
      continue;
    }
    const day = resolved.get(dayNumber) ?? [];
    day.push({
      exerciseCode,
      name,
      order,
      sets,
      repsMin: known.repsMin,
      repsMax: known.repsMax,
      allowsAbsAddon,
    });
    resolved.set(dayNumber, day);
  }

  const dayNumbers = [...structure.keys()].sort((left, right) => left - right);
  const expectedDays = Array.from(
    { length: identity.frequencyPerWeek },
    (_, index) => index + 1,
  );
  if (
    dayNumbers.length !== expectedDays.length ||
    dayNumbers.some((dayNumber, index) => dayNumber !== expectedDays[index])
  ) {
    throw new Error(
      `${code} lists days ${dayNumbers.join(', ') || 'none'} but its frequency is ${identity.frequencyPerWeek}`,
    );
  }

  for (const [dayNumber, exercises] of structure) {
    const orders = exercises.map((row) => row.order);
    if (new Set(orders).size !== orders.length) {
      throw new Error(`${code} day ${dayNumber} repeats an exercise order`);
    }
    const contiguous = [...orders].sort((left, right) => left - right);
    if (contiguous.some((order, index) => order !== index + 1)) {
      throw new Error(
        `${code} day ${dayNumber} has exercise orders ${contiguous.join(', ')} instead of 1..${contiguous.length}`,
      );
    }
    const sorted = [...exercises].sort(
      (left, right) => left.order - right.order,
    );
    sorted.forEach((row, index) => {
      if (row.allowsAbsAddon && index !== sorted.length - 1) {
        throw new Error(
          `${code} day ${dayNumber} marks an abs add-on on order ${row.order}, which is not the last exercise`,
        );
      }
    });
  }

  return {
    ...identity,
    days: [...resolved.entries()]
      .sort(([left], [right]) => left - right)
      .map(([dayNumber, exercises]) => ({
        dayNumber,
        exercises: exercises.sort((left, right) => left.order - right.order),
      })),
  };
}

function parseIdentity(code: string, subtitle: string) {
  const match = code.match(/^([WM])([BMP])([234])([A-Z])?$/);
  if (!match) {
    throw new Error(`Program code ${code} does not match the template pattern`);
  }
  const [, genderLetter, levelLetter, frequencyText, accentLetter = ''] = match;
  const levelFromCode = levelLetter ? LEVEL_LETTERS[levelLetter] : undefined;
  const frequencyFromCode = Number(frequencyText);

  const parts = subtitle.split('·').map((part) => part.trim());
  const genderLabel = parts[0]?.split('—').at(-1)?.trim() ?? '';
  const gender = GENDER_LABELS[genderLabel];
  const level = parts[1] ? LEVEL_LABELS[parts[1]] : undefined;
  const frequencyMatch = parts[2]?.match(/(\d+)/);
  const frequency = frequencyMatch ? Number(frequencyMatch[1]) : undefined;
  const accentLabel = parts[3]?.replace(/;+$/, '').trim() ?? '';
  const accent = ACCENT_LABELS[accentLabel];
  const accentLetters =
    gender === 'MALE' ? MALE_ACCENT_LETTERS : FEMALE_ACCENT_LETTERS;
  const accentFromCode = accentLetters[accentLetter];
  const genderLetterMatches =
    (gender === 'FEMALE' && genderLetter === 'W') ||
    (gender === 'MALE' && genderLetter === 'M');

  if (!gender || !level || !frequency || !accent || !parts[0]) {
    throw new Error(`Program ${code} has an unreadable subtitle: ${subtitle}`);
  }
  if (!genderLetterMatches || accentFromCode === undefined) {
    throw new Error(`Program code ${code} does not match the template pattern`);
  }
  if (
    levelFromCode !== level ||
    frequencyFromCode !== frequency ||
    accentFromCode !== accent
  ) {
    throw new Error(`Program ${code} disagrees with its subtitle: ${subtitle}`);
  }

  return {
    code,
    name: `${parts[0]} · ${parts[1] ?? ''} · ${parts[2] ?? ''} · ${accentLabel}`,
    gender,
    level,
    frequencyPerWeek: frequency,
    accent,
  };
}

function parseRepRange(value: string, code: string) {
  const match = value.match(/^(\d+)-(\d+)$/);
  if (!match) {
    throw new Error(`${code} has an unreadable rep range "${value}"`);
  }
  const repsMin = Number(match[1]);
  const repsMax = Number(match[2]);
  if (repsMin > repsMax) {
    throw new Error(
      `${code} has a rep range whose minimum exceeds its maximum`,
    );
  }
  return { repsMin, repsMax };
}

function parseMuscles(value: string, code: string): ParsedMuscleGroup[] {
  const labels = value
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
  return labels.map((label) => {
    const group = MUSCLE_LABELS[label];
    if (!group) {
      throw new Error(`${code} has an unknown muscle group "${label}"`);
    }
    return group;
  });
}

function indexExercises(exercises: ParsedExercise[]) {
  const library = new Map<string, ParsedExercise>();
  for (const exercise of exercises) {
    if (!library.has(exercise.code)) library.set(exercise.code, exercise);
  }
  return library;
}
