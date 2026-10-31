import { NutritionInputError } from './nutrition-calculation.js';

/** Full calendar years of a date-only birthday in the profile timezone. */
export function ageInTimeZone(
  dateOfBirth: Date,
  timeZone: string,
  now: Date,
): number {
  const birth = civilDate(dateOfBirth, 'UTC');
  let today: CivilDate;
  try {
    today = civilDate(now, timeZone);
  } catch {
    throw new NutritionInputError('timezone is not supported');
  }
  let age = today.year - birth.year;
  if (
    today.month < birth.month ||
    (today.month === birth.month && today.day < birth.day)
  ) {
    age -= 1;
  }
  return age;
}

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

function civilDate(value: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}
