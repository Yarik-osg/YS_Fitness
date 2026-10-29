'use client';

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

const DRAFT_VERSION = 1;
const WRITE_DELAY_MS = 300;
const DRAFT_CHANGE_EVENT = 'ys-fitness:workout-draft';

export type WorkoutDraftSet = {
  weight: string;
  reps: string;
  skipped: boolean;
};

type WorkoutDraftExercise = {
  exerciseId: string;
  sets: WorkoutDraftSet[];
};

type WorkoutDraft = {
  v: typeof DRAFT_VERSION;
  exercises: WorkoutDraftExercise[];
};

export function workoutDraftKey(
  userId: string,
  templateId: string,
  dayNumber: number,
) {
  return `ys-fitness:workout-draft:${userId}:${templateId}:${dayNumber}`;
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    if (typeof storage?.getItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
}

export function readWorkoutDraft(key: string): unknown {
  try {
    const text = browserStorage()?.getItem(key);
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function writeWorkoutDraft(
  key: string,
  exercises: WorkoutDraftExercise[],
) {
  try {
    const payload: WorkoutDraft = {
      v: DRAFT_VERSION,
      exercises: exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: exercise.sets.map((set) => ({
          weight: set.weight,
          reps: set.reps,
          skipped: set.skipped,
        })),
      })),
    };
    browserStorage()?.setItem(key, JSON.stringify(payload));
    notifyDraftChange();
  } catch {
    // Private mode and a full disk both throw. The form still holds the draft.
  }
}

function notifyDraftChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DRAFT_CHANGE_EVENT));
}

function subscribeDraftStorage(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(DRAFT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(DRAFT_CHANGE_EVENT, onStoreChange);
  };
}

/** Same rule as the session: only the last set of a four-set exercise. */
function isSkippableSet(setCount: number, index: number) {
  return setCount === 4 && index === 3;
}

function draftHasEntry(exercises: WorkoutDraftExercise[]) {
  return exercises.some((exercise) =>
    exercise.sets.some(
      (set, index) =>
        set.weight !== '' ||
        set.reps !== '' ||
        (set.skipped && isSkippableSet(exercise.sets.length, index)),
    ),
  );
}

function persistWorkoutDraft(key: string, exercises: WorkoutDraftExercise[]) {
  if (draftHasEntry(exercises)) writeWorkoutDraft(key, exercises);
  else clearWorkoutDraft(key);
}

/** True when this workout has a saved set with a weight, reps, or a skip. */
export function hasWorkoutDraft(
  userId: string | undefined,
  templateId: string,
  dayNumber: number,
) {
  if (!userId) return false;
  const raw = readWorkoutDraft(workoutDraftKey(userId, templateId, dayNumber));
  if (!raw || typeof raw !== 'object') return false;
  const body = raw as Record<string, unknown>;
  if (body.v !== DRAFT_VERSION || !Array.isArray(body.exercises)) return false;
  return body.exercises.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const sets = (entry as { sets?: unknown }).sets;
    return (
      Array.isArray(sets) &&
      sets.some(
        (set, index) =>
          isDraftSet(set) &&
          (set.weight !== '' ||
            set.reps !== '' ||
            (set.skipped && isSkippableSet(sets.length, index))),
      )
    );
  });
}

export function useHasWorkoutDraft(
  userId: string | undefined,
  templateId: string,
  dayNumber: number,
) {
  return useSyncExternalStore(
    subscribeDraftStorage,
    () => hasWorkoutDraft(userId, templateId, dayNumber),
    () => false,
  );
}

export function clearWorkoutDraft(key: string) {
  try {
    browserStorage()?.removeItem(key);
    notifyDraftChange();
  } catch {
    // Ignore storage failures. A leftover key only restores this same workout.
  }
}

function isDraftSet(value: unknown): value is WorkoutDraftSet {
  if (!value || typeof value !== 'object') return false;
  const set = value as Record<string, unknown>;
  return (
    typeof set.weight === 'string' &&
    typeof set.reps === 'string' &&
    typeof set.skipped === 'boolean' &&
    set.weight.length <= 16 &&
    set.reps.length <= 3
  );
}

/** Keep the live prescription. Copy only valid stored sets onto matching indexes. */
export function applyWorkoutDraft<T extends WorkoutDraftExercise>(
  current: T[],
  raw: unknown,
): T[] {
  if (!raw || typeof raw !== 'object') return current;
  const body = raw as Record<string, unknown>;
  if (body.v !== DRAFT_VERSION || !Array.isArray(body.exercises))
    return current;

  const stored = new Map<string, unknown[]>();
  for (const entry of body.exercises) {
    if (!entry || typeof entry !== 'object') continue;
    const exercise = entry as Record<string, unknown>;
    if (
      typeof exercise.exerciseId !== 'string' ||
      !Array.isArray(exercise.sets)
    ) {
      continue;
    }
    stored.set(exercise.exerciseId, exercise.sets);
  }

  return current.map((exercise) => {
    const sets = stored.get(exercise.exerciseId);
    if (!sets) return exercise;
    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => {
        const saved = sets[index];
        if (!isDraftSet(saved)) return set;
        return {
          ...set,
          weight: saved.weight,
          reps: saved.reps,
          skipped: saved.skipped && isSkippableSet(exercise.sets.length, index),
        };
      }),
    };
  });
}

/**
 * Restores a draft after mount, debounces edits, and flushes the latest
 * exercises on pagehide through a ref so the listener never closes over state.
 */
export function useWorkoutDraft<T extends WorkoutDraftExercise>(
  userId: string | undefined,
  templateId: string,
  dayNumber: number,
  exercises: T[],
  setExercises: Dispatch<SetStateAction<T[]>>,
  onRestore?: (exercises: T[]) => void,
) {
  const key = userId ? workoutDraftKey(userId, templateId, dayNumber) : null;
  const exercisesRef = useRef(exercises);
  const keyRef = useRef(key);
  const onRestoreRef = useRef(onRestore);
  const readyRef = useRef(false);
  const retiredRef = useRef(false);
  const revisionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const phaseRef = useRef<'mount' | 'restored' | 'live'>('mount');

  useLayoutEffect(() => {
    exercisesRef.current = exercises;
    keyRef.current = key;
    onRestoreRef.current = onRestore;
  }, [exercises, key, onRestore]);

  useLayoutEffect(() => {
    readyRef.current = false;
    retiredRef.current = false;
    revisionRef.current = 0;
    phaseRef.current = 'mount';
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    let restored = exercisesRef.current;
    if (key) {
      const raw = readWorkoutDraft(key);
      if (raw) {
        restored = applyWorkoutDraft(exercisesRef.current, raw);
        exercisesRef.current = restored;
        setExercises(restored);
      }
    }
    onRestoreRef.current?.(restored);
    phaseRef.current = 'restored';
    readyRef.current = true;
  }, [key, setExercises]);

  useEffect(() => {
    if (!key || phaseRef.current === 'mount') return;
    if (phaseRef.current === 'restored') {
      phaseRef.current = 'live';
      return;
    }
    revisionRef.current += 1;
    const revision = revisionRef.current;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (retiredRef.current || revisionRef.current !== revision) return;
      persistWorkoutDraft(key, exercisesRef.current);
    }, WRITE_DELAY_MS);
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [exercises, key]);

  useEffect(() => {
    const flush = () => {
      const currentKey = keyRef.current;
      if (!currentKey || !readyRef.current || retiredRef.current) return;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      persistWorkoutDraft(currentKey, exercisesRef.current);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  return {
    currentRevision: () => revisionRef.current,
    /** Drop this key only when no newer edit landed after submit started. */
    commitSubmitted: (submittedRevision: number) => {
      const currentKey = keyRef.current;
      if (!currentKey || revisionRef.current !== submittedRevision) return;
      retiredRef.current = true;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      clearWorkoutDraft(currentKey);
    },
    discard: () => {
      const currentKey = keyRef.current;
      if (!currentKey) return;
      retiredRef.current = true;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      clearWorkoutDraft(currentKey);
    },
    /** Drop the saved draft and keep later edits. One following render does not write it back. */
    release: (next: T[]) => {
      const currentKey = keyRef.current;
      if (!currentKey) return;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      revisionRef.current += 1;
      phaseRef.current = 'restored';
      retiredRef.current = false;
      exercisesRef.current = next;
      clearWorkoutDraft(currentKey);
    },
  };
}
