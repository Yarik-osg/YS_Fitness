export { expectedProgramSessions } from '@repo/shared-types';

export function nextProgramDay(
  lastDayNumber: number | null,
  frequencyPerWeek: number,
): number {
  if (lastDayNumber == null || frequencyPerWeek < 1) return 1;
  return (lastDayNumber % frequencyPerWeek) + 1;
}
