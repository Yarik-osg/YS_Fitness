import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyWorkoutDraft,
  hasWorkoutDraft,
  useHasWorkoutDraft,
  workoutDraftKey,
  writeWorkoutDraft,
} from './workout-draft';

const base = [
  {
    exerciseId: 'row',
    sets: [
      { weight: '', reps: '', skipped: false },
      { weight: '', reps: '', skipped: false },
    ],
  },
  {
    exerciseId: 'press',
    sets: [{ weight: '', reps: '', skipped: false }],
  },
];

describe('applyWorkoutDraft', () => {
  it('copies matching sets and keeps new prescription defaults', () => {
    const next = applyWorkoutDraft(base, {
      v: 1,
      exercises: [
        {
          exerciseId: 'gone',
          sets: [{ weight: '1', reps: '1', skipped: false }],
        },
        {
          exerciseId: 'row',
          sets: [
            { weight: '20', reps: '8', skipped: false },
            { weight: 30, reps: '9', skipped: false },
            { weight: '40', reps: '10', skipped: true },
          ],
        },
      ],
    });

    expect(next[0]?.sets[0]).toEqual({
      weight: '20',
      reps: '8',
      skipped: false,
    });
    expect(next[0]?.sets[1]).toEqual({
      weight: '',
      reps: '',
      skipped: false,
    });
    expect(next[0]?.sets).toHaveLength(2);
    expect(next[1]?.sets[0]).toEqual({
      weight: '',
      reps: '',
      skipped: false,
    });
    expect(next).toHaveLength(2);
  });

  it('keeps a skip only on the fourth set of a four-set exercise', () => {
    const four = [
      {
        exerciseId: 'row',
        sets: [
          { weight: '', reps: '', skipped: false },
          { weight: '', reps: '', skipped: false },
          { weight: '', reps: '', skipped: false },
          { weight: '', reps: '', skipped: false },
        ],
      },
    ];
    const next = applyWorkoutDraft(four, {
      v: 1,
      exercises: [
        {
          exerciseId: 'row',
          sets: [
            { weight: '', reps: '', skipped: true },
            { weight: '10', reps: '8', skipped: false },
            { weight: '', reps: '', skipped: false },
            { weight: '', reps: '', skipped: true },
          ],
        },
      ],
    });

    expect(next[0]?.sets[0]).toEqual({
      weight: '',
      reps: '',
      skipped: false,
    });
    expect(next[0]?.sets[3]?.skipped).toBe(true);
  });

  it('leaves the form alone when the payload is not a version 1 draft', () => {
    expect(applyWorkoutDraft(base, null)).toBe(base);
    expect(applyWorkoutDraft(base, { v: 2, exercises: [] })).toBe(base);
    expect(applyWorkoutDraft(base, { v: 1, exercises: 'nope' })).toBe(base);
  });

  it('scopes the key to the user, template, and day', () => {
    expect(workoutDraftKey('user-a', 'template', 1)).toBe(
      'ys-fitness:workout-draft:user-a:template:1',
    );
    expect(workoutDraftKey('user-b', 'template', 1)).not.toBe(
      workoutDraftKey('user-a', 'template', 1),
    );
  });
});

describe('hasWorkoutDraft', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('is true only for a saved set on that user, template, and day', () => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    });
    writeWorkoutDraft(workoutDraftKey('user-1', 'template', 2), [
      {
        exerciseId: 'row',
        sets: [{ weight: '', reps: '8', skipped: false }],
      },
    ]);

    expect(hasWorkoutDraft('user-1', 'template', 2)).toBe(true);
    expect(hasWorkoutDraft('user-1', 'template', 1)).toBe(false);
    expect(hasWorkoutDraft('user-2', 'template', 2)).toBe(false);
    expect(hasWorkoutDraft(undefined, 'template', 2)).toBe(false);

    writeWorkoutDraft(workoutDraftKey('user-1', 'template', 2), [
      {
        exerciseId: 'row',
        sets: [{ weight: '', reps: '', skipped: false }],
      },
    ]);
    expect(hasWorkoutDraft('user-1', 'template', 2)).toBe(false);

    writeWorkoutDraft(workoutDraftKey('user-1', 'template', 2), [
      {
        exerciseId: 'row',
        sets: [
          { weight: '', reps: '', skipped: true },
          { weight: '', reps: '', skipped: false },
        ],
      },
    ]);
    expect(hasWorkoutDraft('user-1', 'template', 2)).toBe(false);
  });

  it('updates a mounted reader in this same tab', () => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    });
    const { result } = renderHook(() =>
      useHasWorkoutDraft('user-1', 'template', 2),
    );
    expect(result.current).toBe(false);

    act(() => {
      writeWorkoutDraft(workoutDraftKey('user-1', 'template', 2), [
        {
          exerciseId: 'row',
          sets: [{ weight: '', reps: '8', skipped: false }],
        },
      ]);
    });

    expect(result.current).toBe(true);
  });
});
