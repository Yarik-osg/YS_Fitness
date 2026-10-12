// Calendar math in the browser's local time. Weeks start on Monday.

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Adds whole calendar days; a DST change does not shift the wall-clock day. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday 00:00 of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  const sinceMonday = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -sinceMonday);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The first day of the month `months` away from `date`'s month. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function isSameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function weekDays(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/**
 * Every day shown for a month, Monday first, in whole weeks that contain at
 * least one day of the month (4 to 6 rows of 7).
 */
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const gridEnd = addDays(startOfWeek(last), 7);
  const days: Date[] = [];
  for (let day = gridStart; day < gridEnd; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/** Local calendar date as `YYYY-MM-DD`; used to compare and group days. */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Query range for the days from `firstDay` through `lastDay` inclusive: local
 * midnight to the next local midnight, as ISO instants.
 */
export function dayRange(
  firstDay: Date,
  lastDay: Date,
): { from: string; to: string } {
  return {
    from: startOfDay(firstDay).toISOString(),
    to: addDays(lastDay, 1).toISOString(),
  };
}

/** Groups items by the local date of their `completedAt` instant. */
export function groupByLocalDay<T extends { completedAt: string }>(
  items: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = localDateKey(new Date(item.completedAt));
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
