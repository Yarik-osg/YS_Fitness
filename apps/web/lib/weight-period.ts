export type WeightPeriod = '30d' | '3m' | 'all';

/** Trailing calendar months, clamped to the last valid day of the target month. */
export function subtractCalendarMonths(date: Date, months: number): Date {
  const monthIndex = date.getMonth() - months;
  const targetMonth = new Date(date.getFullYear(), monthIndex, 1);
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
  ).getDate();
  const day = Math.min(date.getDate(), lastDay);

  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    day,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

export function periodStart(now: Date, period: WeightPeriod): Date | null {
  if (period === 'all') return null;
  if (period === '30d')
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return subtractCalendarMonths(now, 3);
}

export function inPeriod(
  measuredAt: string,
  now: Date,
  period: WeightPeriod,
): boolean {
  const start = periodStart(now, period);
  if (!start) return true;
  return Date.parse(measuredAt) >= start.getTime();
}
