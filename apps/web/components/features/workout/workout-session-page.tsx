'use client';

import type {
  AssignedProgramResponse,
  ProgramDayResponse,
  WeightRecommendation,
  WorkoutLogResponse,
  WorkoutLogSetResponse,
} from '@repo/shared-types';
import type { LogWorkoutInput } from '@repo/validation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { useMyProgram } from '@/lib/hooks/use-programs';
import { useLogWorkout, useWorkoutLogs } from '@/lib/hooks/use-workouts';

type SetDraft = { weight: string; reps: string };

type ExerciseDraft = {
  exerciseId: string;
  order: number;
  name: string;
  prescribedSets: number;
  repsLabel: string;
  allowsAbsAddon: boolean;
  sets: SetDraft[];
};

type SavedSession = {
  exerciseCount: number;
  totalExercises: number;
  setCount: number;
  dayNumber: string;
  muscles: string;
};

export function WorkoutSessionPage() {
  const programQuery = useMyProgram();
  const logsQuery = useWorkoutLogs();
  const t = useTranslations('workouts');

  if (programQuery.isPending && !programQuery.data) {
    return (
      <main
        aria-busy="true"
        aria-label={t('loading')}
        className="mx-auto grid min-h-screen w-full max-w-[430px] place-items-center bg-[#0b0b0b]"
      >
        <div className="h-0.5 w-24 animate-pulse bg-white/30" />
      </main>
    );
  }

  const program = programQuery.data;
  const day =
    program?.days.find((entry) => entry.dayNumber === program.nextDayNumber) ??
    program?.days[0];
  if (!program || !day) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center gap-6 bg-[#0b0b0b] px-6 text-center">
        <p className="text-sm text-white/50">{t('noProgram')}</p>
        <Link
          href="/dashboard"
          className={buttonVariants({ className: 'w-full' })}
        >
          {t('completion.back')}
        </Link>
      </main>
    );
  }

  return (
    <SessionForm
      program={program}
      day={day}
      logs={logsQuery.data?.logs ?? []}
    />
  );
}

function SessionForm({
  program,
  day,
  logs,
}: {
  program: AssignedProgramResponse;
  day: ProgramDayResponse;
  logs: WorkoutLogResponse[];
}) {
  const t = useTranslations('workouts');
  const muscles = useTranslations('dashboard.workouts');
  const logWorkout = useLogWorkout();
  const [exercises, setExercises] = useState(() => initialExercises(day));
  const [expandedId, setExpandedId] = useState(
    exercises[0]?.exerciseId ?? null,
  );
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSession | null>(null);

  const dayNumber = String(day.dayNumber).padStart(2, '0');
  const muscleLine = muscleLabels(day, muscles);
  const completedCount = exercises.filter((exercise) =>
    exercise.sets.some((set) => isFilledReps(set.reps)),
  ).length;

  if (saved) {
    return (
      <Completion
        dayNumber={saved.dayNumber}
        muscles={saved.muscles}
        exerciseCount={saved.exerciseCount}
        totalExercises={saved.totalExercises}
        setCount={saved.setCount}
      />
    );
  }

  async function finish() {
    const submission = setsToSubmit(exercises);
    if (submission.status === 'empty') {
      setConfirmEmpty(true);
      return;
    }
    if (submission.status === 'partial') {
      setError(t('incompleteSets'));
      return;
    }
    setError(null);
    try {
      await logWorkout.mutateAsync({
        templateId: program.templateId,
        dayNumber: day.dayNumber,
        sets: submission.sets,
      });
      setSaved({
        exerciseCount: new Set(submission.sets.map((set) => set.exerciseId))
          .size,
        totalExercises: exercises.length,
        setCount: submission.sets.length,
        dayNumber,
        muscles: muscleLine,
      });
    } catch {
      setError(t('saveError'));
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#0b0b0b] text-white">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b0b] px-5 pt-8 pb-4">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 font-label text-[9px] font-semibold tracking-[0.14em] text-white/30 uppercase"
        >
          {t('back')}
        </Link>
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 font-label text-[8px] font-semibold tracking-[0.18em] text-[#35f5e8] uppercase">
              {t('eyebrow')}
            </p>
            <h1 className="font-heading text-[26px] leading-none text-white uppercase">
              {t('title', { number: dayNumber })}
            </h1>
            {muscleLine ? (
              <p className="mt-1 text-[11px] font-medium text-white/40">
                {muscleLine}
              </p>
            ) : null}
          </div>
          <p className="font-heading text-[11px] tracking-[0.06em] text-white/25 uppercase">
            {t('exerciseCount', { count: exercises.length })}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-0.5 flex-1 bg-white/5">
            <div
              className="h-full bg-[#35f5e8]"
              style={{
                width: `${exercises.length === 0 ? 0 : (completedCount / exercises.length) * 100}%`,
              }}
            />
          </div>
          <span className="font-label text-[9px] font-bold tracking-[0.1em] text-[#35f5e8] uppercase">
            {t('progress', { done: completedCount, total: exercises.length })}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-2 px-3.5 pt-2.5 pb-36">
        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.exerciseId}
            exercise={exercise}
            expanded={expandedId === exercise.exerciseId}
            previous={previousSession(
              logs,
              program.templateId,
              day.dayNumber,
              exercise.exerciseId,
            )}
            onToggle={() =>
              setExpandedId((current) =>
                current === exercise.exerciseId ? null : exercise.exerciseId,
              )
            }
            onChangeSet={(index, field, value) =>
              setExercises((current) =>
                current.map((row) =>
                  row.exerciseId === exercise.exerciseId
                    ? {
                        ...row,
                        sets: row.sets.map((set, setIndex) =>
                          setIndex === index ? { ...set, [field]: value } : set,
                        ),
                      }
                    : row,
                ),
              )
            }
            onComplete={() => {
              const index = exercises.findIndex(
                (row) => row.exerciseId === exercise.exerciseId,
              );
              setExpandedId(exercises[index + 1]?.exerciseId ?? null);
            }}
          />
        ))}
      </div>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-linear-to-t from-[#0b0b0b] from-75% to-transparent px-3.5 pt-4 pb-8">
        {error ? (
          <p className="mb-2 text-center text-xs text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className={buttonVariants({
            className:
              'w-full bg-[#c8ff2e] text-[#0b0b0b] shadow-[0_0_24px_rgba(200,255,46,0.2)]',
          })}
          disabled={logWorkout.isPending}
          onClick={() => void finish()}
        >
          {logWorkout.isPending ? t('saving') : t('finish')}
        </button>
      </div>

      {confirmEmpty ? (
        <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-[430px] items-end bg-black/70">
          <div
            role="dialog"
            aria-labelledby="empty-log-title"
            className="w-full border-t border-white/10 bg-[#111] px-5 pt-7 pb-9"
          >
            <h2
              id="empty-log-title"
              className="mb-3 text-center font-label text-sm font-bold tracking-[0.06em] text-white uppercase"
            >
              {t('emptyTitle')}
            </h2>
            <p className="mb-7 text-center text-[13px] leading-relaxed text-white/50">
              {t('emptyBody')}
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                className={buttonVariants({ className: 'w-full' })}
                onClick={() => setConfirmEmpty(false)}
              >
                {t('continue')}
              </button>
              <Link
                href="/dashboard"
                className={buttonVariants({
                  variant: 'outline',
                  className: 'w-full',
                })}
              >
                {t('finishWithoutSave')}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExerciseCard({
  exercise,
  expanded,
  previous,
  onToggle,
  onChangeSet,
  onComplete,
}: {
  exercise: ExerciseDraft;
  expanded: boolean;
  previous: PreviousSession | null;
  onToggle: () => void;
  onChangeSet: (index: number, field: keyof SetDraft, value: string) => void;
  onComplete: () => void;
}) {
  const t = useTranslations('workouts');
  const hint = useTranslations('dashboard.workouts');
  const filled = exercise.sets.some((set) => isFilledReps(set.reps));

  return (
    <article
      className={`border-[1.5px] ${
        expanded
          ? 'border-white/15 bg-white/[0.015]'
          : filled
            ? 'border-[#35f5e8]/30 bg-[#35f5e8]/[0.02]'
            : 'border-white/6'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={onToggle}
      >
        <span className="grid size-[34px] shrink-0 place-items-center border-[1.5px] border-white/10 font-heading text-sm text-white/40">
          {String(exercise.order).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-[15px] tracking-[0.04em] text-white/80 uppercase">
            {exercise.name}
          </span>
          <span className="mt-1 block text-[11px] font-medium text-white/30">
            {t('meta', {
              sets: exercise.prescribedSets,
              reps: exercise.repsLabel,
            })}
          </span>
          {exercise.allowsAbsAddon ? (
            <span className="mt-1 block font-label text-[8px] font-semibold tracking-[0.12em] text-[#c8ff2e]/80 uppercase">
              {hint('absExercise')} · {hint('optional')}
            </span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-white/5 px-4 pt-4 pb-5">
          <div className="mb-4 flex gap-2">
            <Prescribed
              value={String(exercise.prescribedSets)}
              label={t('prescribedSets')}
            />
            <Prescribed
              value={exercise.repsLabel}
              label={t('prescribedReps')}
            />
          </div>
          {previous && previous.sets.length > 0 ? (
            <div className="mb-4 border-l-2 border-white/10 bg-white/[0.015] px-3.5 py-2.5">
              <p className="mb-1.5 font-label text-[7px] font-semibold tracking-[0.16em] text-white/30 uppercase">
                {t('previous')}
              </p>
              <p className="text-xs font-medium text-white/40">
                {previous.sets
                  .map((set) =>
                    set.weightKg == null
                      ? t('previousReps', { reps: String(set.repsCompleted) })
                      : t('previousSet', {
                          weight: String(set.weightKg),
                          reps: String(set.repsCompleted),
                        }),
                  )
                  .join(' • ')}
              </p>
              {previous.recommendation ? (
                <p className="mt-2 text-sm font-semibold text-[#ffb15a]">
                  {t(
                    previous.recommendation === 'increase'
                      ? 'recommendIncrease'
                      : 'recommendDecrease',
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mb-2 grid grid-cols-[36px_1fr_1fr] gap-2">
            {[t('columnSet'), t('columnWeight'), t('columnReps')].map(
              (label) => (
                <span
                  key={label}
                  className="text-center font-label text-[7px] font-semibold tracking-[0.12em] text-white/20 uppercase"
                >
                  {label}
                </span>
              ),
            )}
          </div>
          {exercise.sets.map((set, index) => (
            <div
              key={`${exercise.exerciseId}-${index}`}
              className="mb-2 grid grid-cols-[36px_1fr_1fr] items-center gap-2"
            >
              <span className="grid h-[42px] place-items-center border border-white/10 font-heading text-base text-white/30">
                {index + 1}
              </span>
              <label className="flex h-[42px] items-center border-[1.5px] border-white/10 bg-white/[0.03] focus-within:border-[#35f5e8]">
                <input
                  aria-label={t('weightInput', { set: index + 1 })}
                  inputMode="decimal"
                  value={set.weight}
                  placeholder="—"
                  className="w-full bg-transparent text-center text-[17px] font-semibold text-white outline-none"
                  onChange={(event) =>
                    onChangeSet(
                      index,
                      'weight',
                      sanitizeWeight(event.target.value),
                    )
                  }
                />
                <span className="pr-2 text-[10px] text-white/30">
                  {t('kg')}
                </span>
              </label>
              <label className="flex h-[42px] items-center border-[1.5px] border-white/10 bg-white/[0.03] focus-within:border-[#35f5e8]">
                <input
                  aria-label={t('repsInput', { set: index + 1 })}
                  inputMode="numeric"
                  value={set.reps}
                  placeholder="—"
                  className="w-full bg-transparent text-center text-[17px] font-semibold text-white outline-none"
                  onChange={(event) =>
                    onChangeSet(
                      index,
                      'reps',
                      event.target.value.replace(/\D/g, '').slice(0, 3),
                    )
                  }
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className={buttonVariants({ className: 'mt-3.5 w-full' })}
            onClick={onComplete}
          >
            {t('completeExercise')}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function Prescribed({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 border border-[#c8ff2e]/10 bg-[#c8ff2e]/[0.07] px-2.5 py-3 text-center">
      <p className="font-heading text-[26px] leading-none text-[#c8ff2e]">
        {value}
      </p>
      <p className="mt-1 font-label text-[7px] font-semibold tracking-[0.14em] text-white/30 uppercase">
        {label}
      </p>
    </div>
  );
}

function Completion({
  dayNumber,
  muscles,
  exerciseCount,
  totalExercises,
  setCount,
}: SavedSession) {
  const t = useTranslations('workouts');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[#0b0b0b] px-5 pt-14 pb-10 text-white">
      <div className="mb-9 flex flex-col items-center text-center">
        <div className="mb-6 grid size-20 place-items-center rounded-full border-2 border-[#c8ff2e] bg-[#c8ff2e]/[0.07] shadow-[0_0_40px_rgba(200,255,46,0.22)]">
          <span className="font-heading text-3xl text-[#c8ff2e]">✓</span>
        </div>
        <p className="mb-2.5 font-label text-[8px] font-semibold tracking-[0.2em] text-[#35f5e8] uppercase">
          {t('completion.brand')}
        </p>
        <h1 className="font-heading text-[30px] leading-none text-white uppercase">
          {t('completion.title')}
        </h1>
        <div className="my-3 h-px w-14 bg-[#c8ff2e]" />
        <p className="text-xs font-medium text-white/50">
          {t('completion.saved')}
        </p>
      </div>
      <div className="mb-3 border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
        <p className="font-heading text-lg text-white uppercase">
          {t('title', { number: dayNumber })}
        </p>
        {muscles ? (
          <p className="text-[11px] font-medium text-white/40">{muscles}</p>
        ) : null}
      </div>
      <div className="mb-8 grid grid-cols-2 gap-px">
        <Stat
          value={`${exerciseCount}/${totalExercises}`}
          label={t('completion.exercises')}
          tone="text-[#35f5e8]"
        />
        <Stat
          value={String(setCount)}
          label={t('completion.sets')}
          tone="text-[#c8ff2e]"
        />
      </div>
      <Link
        href="/dashboard"
        className={buttonVariants({
          className:
            'w-full bg-[#c8ff2e] text-[#0b0b0b] shadow-[0_0_24px_rgba(200,255,46,0.2)]',
        })}
      >
        {t('completion.back')}
      </Link>
      <p className="mt-5 text-center font-label text-[8px] font-medium tracking-[0.12em] text-white/20">
        {t('completion.mottoLead')}{' '}
        <span className="text-[#c8ff2e]">{t('completion.mottoAccent')}</span>
      </p>
    </main>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="border border-white/[0.06] bg-white/[0.02] px-2 py-3 text-center">
      <p className={`font-heading text-xl leading-none ${tone}`}>{value}</p>
      <p className="mt-1 font-label text-[7px] font-semibold tracking-[0.1em] text-white/30 uppercase">
        {label}
      </p>
    </div>
  );
}

function initialExercises(day: ProgramDayResponse): ExerciseDraft[] {
  return day.exercises.map((row) => ({
    exerciseId: row.exercise.id,
    order: row.order,
    name: row.exercise.name,
    prescribedSets: row.sets,
    repsLabel: `${row.exercise.repsMin}–${row.exercise.repsMax}`,
    allowsAbsAddon: row.allowsAbsAddon,
    sets: Array.from({ length: row.sets }, () => ({ weight: '', reps: '' })),
  }));
}

function muscleLabels(
  day: ProgramDayResponse,
  t: ReturnType<typeof useTranslations<'dashboard.workouts'>>,
) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const row of day.exercises) {
    for (const group of row.exercise.muscleGroups) {
      if (seen.has(group)) continue;
      seen.add(group);
      labels.push(t(`muscles.${group}`));
    }
  }
  return labels.join(' • ');
}

type PreviousSession = {
  sets: WorkoutLogSetResponse[];
  recommendation: WeightRecommendation | null;
};

function previousSession(
  logs: WorkoutLogResponse[],
  templateId: string,
  dayNumber: number,
  exerciseId: string,
): PreviousSession | null {
  const log = logs.find(
    (entry) =>
      entry.templateId === templateId &&
      entry.dayNumber === dayNumber &&
      entry.sets.some((set) => set.exerciseId === exerciseId),
  );
  if (!log) return null;
  const sets = log.sets
    .filter((set) => set.exerciseId === exerciseId)
    .sort((left, right) => left.setNumber - right.setNumber);
  return {
    sets,
    recommendation: sets[sets.length - 1]?.recommendation ?? null,
  };
}

function isFilledReps(value: string) {
  return /^[1-9]\d{0,2}$/.test(value);
}

function setsToSubmit(
  exercises: ExerciseDraft[],
):
  | { status: 'empty' }
  | { status: 'partial' }
  | { status: 'ready'; sets: LogWorkoutInput['sets'] } {
  const sets: LogWorkoutInput['sets'] = [];
  let prescribed = 0;
  let filled = 0;

  for (const exercise of exercises) {
    exercise.sets.forEach((set, index) => {
      prescribed += 1;
      if (!isFilledReps(set.reps)) return;
      filled += 1;
      const weight = Number(set.weight);
      sets.push({
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        setNumber: index + 1,
        repsCompleted: Number(set.reps),
        ...(set.weight !== '' && Number.isFinite(weight) && weight > 0
          ? { weightKg: weight }
          : {}),
      });
    });
  }

  if (filled === 0) return { status: 'empty' };
  if (filled !== prescribed) return { status: 'partial' };
  return { status: 'ready', sets };
}

function sanitizeWeight(value: string) {
  const cleaned = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole, fraction] = cleaned.split('.');
  if (fraction === undefined) return whole ?? '';
  return `${whole}.${fraction.slice(0, 2)}`;
}
