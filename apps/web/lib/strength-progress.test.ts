import type { WorkoutLogResponse } from '@repo/shared-types';
import { describe, expect, it } from 'vitest';
import { strengthChanges } from './strength-progress';

function log(
  id: string,
  completedAt: string,
  exerciseId: string,
  weightKg: number | null,
): WorkoutLogResponse {
  return {
    id,
    userId: 'user',
    templateId: 'template',
    dayNumber: 1,
    completedAt,
    sets: [
      {
        id: `${id}-set`,
        exerciseId,
        order: 1,
        setNumber: 1,
        repsCompleted: 8,
        weightKg,
        recommendation: null,
        exercise: {
          id: exerciseId,
          code: 'row',
          name: 'Тяга',
          nameEn: 'Row',
          muscleGroups: [],
          repsMin: 8,
          repsMax: 12,
        },
      },
    ],
  };
}

describe('strengthChanges', () => {
  it('uses the earliest and latest loaded weight and skips a single session', () => {
    const changes = strengthChanges([
      log('b', '2026-08-02T00:00:00.000Z', 'row', 42.5),
      log('a', '2026-08-01T00:00:00.000Z', 'row', 35),
      log('c', '2026-08-03T00:00:00.000Z', 'press', 40),
    ]);

    expect(changes).toEqual([
      {
        exerciseId: 'row',
        name: 'Тяга',
        nameEn: 'Row',
        fromKg: 35,
        toKg: 42.5,
      },
    ]);
  });

  it('ranks the largest increase first', () => {
    const changes = strengthChanges([
      log('a1', '2026-08-01T00:00:00.000Z', 'bridge', 100),
      log('a2', '2026-08-02T00:00:00.000Z', 'bridge', 12),
      log('b1', '2026-08-01T00:00:00.000Z', 'curl', 3),
      log('b2', '2026-08-02T00:00:00.000Z', 'curl', 12),
    ]);

    expect(changes.map((change) => change.exerciseId)).toEqual([
      'curl',
      'bridge',
    ]);
  });
});
