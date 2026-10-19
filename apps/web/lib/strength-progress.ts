import type { WorkoutLogResponse } from '@repo/shared-types';

export interface StrengthChange {
  exerciseId: string;
  name: string;
  nameEn: string;
  fromKg: number;
  toKg: number;
}

/**
 * shortcut: callers pass the latest 50 logs, so a starting weight can be
 * newer than the true first session once history is longer than that.
 */
export function strengthChanges(logs: WorkoutLogResponse[]): StrengthChange[] {
  const byExercise = new Map<
    string,
    {
      name: string;
      nameEn: string;
      points: { at: string; id: string; kg: number }[];
    }
  >();

  for (const log of logs) {
    const best = new Map<
      string,
      { name: string; nameEn: string; kg: number }
    >();
    for (const set of log.sets) {
      if (set.weightKg === null || set.weightKg <= 0) continue;
      const current = best.get(set.exerciseId);
      if (current && current.kg >= set.weightKg) continue;
      best.set(set.exerciseId, {
        name: set.exercise.name,
        nameEn: set.exercise.nameEn,
        kg: set.weightKg,
      });
    }
    for (const [exerciseId, entry] of best) {
      const row = byExercise.get(exerciseId) ?? {
        name: entry.name,
        nameEn: entry.nameEn,
        points: [],
      };
      row.points.push({ at: log.completedAt, id: log.id, kg: entry.kg });
      byExercise.set(exerciseId, row);
    }
  }

  const changes: StrengthChange[] = [];
  for (const [exerciseId, row] of byExercise) {
    if (row.points.length < 2) continue;
    const ordered = row.points.slice().sort((left, right) => {
      const byTime = left.at.localeCompare(right.at);
      if (byTime !== 0) return byTime;
      return left.id.localeCompare(right.id);
    });
    const fromKg = ordered[0]!.kg;
    const toKg = ordered[ordered.length - 1]!.kg;
    if (fromKg === toKg) continue;
    changes.push({
      exerciseId,
      name: row.name,
      nameEn: row.nameEn,
      fromKg,
      toKg,
    });
  }

  return changes.sort(
    (left, right) => right.toKg - right.fromKg - (left.toKg - left.fromKg),
  );
}
