import { startOfDay } from '@/lib/calendar';

/**
 * Recommended training weekdays by weekly frequency, as `Date#getDay()` values
 * (0 = Sunday). Rest days are spread so that muscles get a day off in between.
 */
const RECOMMENDED_WEEKDAYS: Record<number, readonly number[]> = {
  2: [2, 4], // Tuesday, Thursday
  3: [1, 3, 5], // Monday, Wednesday, Friday
  4: [1, 2, 4, 5], // Monday, Tuesday, Thursday, Friday
};

export interface TrainingSchedule {
  frequencyPerWeek: number;
  /** ISO instant the program was assigned. Earlier days have no recommendation. */
  assignedAt: string;
}

/** Whether `date` (a local day) is a recommended training day for the program. */
export function isRecommendedDay(
  date: Date,
  schedule: TrainingSchedule | undefined,
): boolean {
  if (!schedule) return false;
  const weekdays = RECOMMENDED_WEEKDAYS[schedule.frequencyPerWeek];
  if (!weekdays) return false;
  const since = startOfDay(new Date(schedule.assignedAt));
  if (Number.isNaN(since.getTime())) return false;
  return (
    startOfDay(date).getTime() >= since.getTime() &&
    weekdays.includes(date.getDay())
  );
}
