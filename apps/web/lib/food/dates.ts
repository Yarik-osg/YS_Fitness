import { isCalendarDate } from '@repo/validation';
import { addDays, localDateKey } from '@/lib/calendar';

/** Local calendar date from `YYYY-MM-DD`. Never parses the string with `Date`. */
export function parseCalendarDate(value: string): Date | null {
  if (!isCalendarDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function formatFoodDate(value: string, locale: string): string {
  const date = parseCalendarDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function selectedFoodDate(param: string | null, now: Date): string {
  if (param && parseCalendarDate(param)) return param;
  return localDateKey(now);
}

export function shiftFoodDate(value: string, days: number): string {
  const date = parseCalendarDate(value);
  if (!date) return value;
  return localDateKey(addDays(date, days));
}
