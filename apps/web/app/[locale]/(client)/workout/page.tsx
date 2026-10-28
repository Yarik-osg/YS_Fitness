import { WorkoutSessionPage } from '@/components/features/workout/workout-session-page';

export function requestedProgramDay(
  raw: string | string[] | undefined,
): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || !/^[1-9]\d*$/.test(value)) return null;
  return Number(value);
}

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[] }>;
}) {
  const { day } = await searchParams;
  return <WorkoutSessionPage requestedDay={requestedProgramDay(day)} />;
}
