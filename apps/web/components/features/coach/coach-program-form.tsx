'use client';

import type {
  ExerciseResponse,
  ProgramAccent,
  TrainerProgramTemplateDetail,
} from '@repo/shared-types';
import type { TrainerTemplateBody } from '@repo/validation';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api/client';
import { exerciseName } from '@/lib/exercise-name';

const ACCENTS = [
  'NONE',
  'UPPER',
  'LOWER',
  'BACK',
  'CHEST',
  'SHOULDERS',
  'ARMS',
  'LEGS',
] as const satisfies readonly ProgramAccent[];

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const FREQUENCIES = [2, 3, 4] as const;

const fieldClass =
  'h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink';

type DraftExercise = {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  allowsAbsAddon: boolean;
};

type Draft = {
  name: string;
  gender: 'female' | 'male';
  level: (typeof LEVELS)[number];
  frequencyPerWeek: (typeof FREQUENCIES)[number];
  accent: ProgramAccent;
  days: { exercises: DraftExercise[] }[];
};

export function coachProgramMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations<'coach'>>,
): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'TEMPLATE_HAS_LOGS') return t('catalog.hasLogs');
    if (error.code === 'TEMPLATE_IN_USE') return t('catalog.inUse');
    if (error.code === 'TEMPLATE_NOT_COPYABLE') return t('catalog.notCopyable');
    if (error.status === 404) return t('catalog.notFound');
    if (error.status < 500 && error.message) return error.message;
  }
  return t('catalog.loadError');
}

function blankExercise(exercise: ExerciseResponse): DraftExercise {
  return {
    exerciseId: exercise.id,
    sets: 3,
    repsMin: exercise.repsMin,
    repsMax: exercise.repsMax,
    allowsAbsAddon: false,
  };
}

function draftFromTemplate(template: TrainerProgramTemplateDetail): Draft {
  const frequency = FREQUENCIES.find(
    (value) => value === template.frequencyPerWeek,
  );
  return {
    name: template.name,
    gender: template.gender,
    level: template.level,
    frequencyPerWeek: frequency ?? 2,
    accent: template.accent,
    days: template.days.map((day) => ({
      exercises: day.exercises.map((row) => ({
        exerciseId: row.exercise.id,
        sets: row.sets,
        repsMin: row.exercise.repsMin,
        repsMax: row.exercise.repsMax,
        allowsAbsAddon: row.allowsAbsAddon,
      })),
    })),
  };
}

function emptyDraft(exercise: ExerciseResponse): Draft {
  return {
    name: '',
    gender: 'female',
    level: 'beginner',
    frequencyPerWeek: 2,
    accent: 'NONE',
    days: [
      { exercises: [blankExercise(exercise)] },
      { exercises: [blankExercise(exercise)] },
    ],
  };
}

export function CoachProgramForm({
  exercises,
  template,
  pending,
  error,
  onSubmit,
}: {
  exercises: ExerciseResponse[];
  template?: TrainerProgramTemplateDetail;
  pending: boolean;
  error: string | null;
  onSubmit: (body: TrainerTemplateBody) => void;
}) {
  const t = useTranslations('coach');
  const fallback = exercises[0];
  const [draft, setDraft] = useState<Draft | null>(() => {
    if (!fallback) return null;
    return template ? draftFromTemplate(template) : emptyDraft(fallback);
  });
  const [repsError, setRepsError] = useState<string | null>(null);

  if (!fallback || !draft) {
    return <p className="mt-8 text-sm text-muted">{t('catalog.empty')}</p>;
  }

  function update(next: Draft) {
    setDraft(next);
  }

  function changeFrequency(frequency: Draft['frequencyPerWeek']) {
    const days = [...draft!.days];
    while (days.length < frequency) {
      days.push({ exercises: [blankExercise(fallback!)] });
    }
    update({
      ...draft!,
      frequencyPerWeek: frequency,
      days: days.slice(0, frequency),
    });
  }

  function submit() {
    const current = draft!;
    const invalid = current.days.some((day) =>
      day.exercises.some((exercise) => exercise.repsMin > exercise.repsMax),
    );
    if (invalid) {
      setRepsError(t('catalog.repsOrder'));
      return;
    }
    setRepsError(null);
    onSubmit({
      name: current.name.trim(),
      gender: current.gender,
      level: current.level,
      frequencyPerWeek: current.frequencyPerWeek,
      accent: current.accent,
      days: current.days.map((day, dayIndex) => ({
        dayNumber: dayIndex + 1,
        exercises: day.exercises.map((exercise, index) => ({
          exerciseId: exercise.exerciseId,
          order: index + 1,
          sets: exercise.sets,
          repsMin: exercise.repsMin,
          repsMax: exercise.repsMax,
          allowsAbsAddon: exercise.allowsAbsAddon,
        })),
      })),
    });
  }

  return (
    <form
      className="mt-8 flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="block text-sm text-ink">
        <span className="mb-1 block text-xs text-muted">
          {t('catalog.name')}
        </span>
        <input
          required
          maxLength={200}
          value={draft.name}
          onChange={(event) => update({ ...draft, name: event.target.value })}
          className={fieldClass}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink">
          <span className="mb-1 block text-xs text-muted">
            {t('catalog.track')}
          </span>
          <select
            value={draft.gender}
            onChange={(event) =>
              update({
                ...draft,
                gender: event.target.value === 'male' ? 'male' : 'female',
              })
            }
            className={fieldClass}
          >
            <option value="female">{t('catalog.female')}</option>
            <option value="male">{t('catalog.male')}</option>
          </select>
        </label>
        <label className="block text-sm text-ink">
          <span className="mb-1 block text-xs text-muted">
            {t('catalog.level')}
          </span>
          <select
            value={draft.level}
            onChange={(event) =>
              update({
                ...draft,
                level: event.target.value as Draft['level'],
              })
            }
            className={fieldClass}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`catalog.levels.${level}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-ink">
          <span className="mb-1 block text-xs text-muted">
            {t('catalog.frequency')}
          </span>
          <select
            value={draft.frequencyPerWeek}
            onChange={(event) =>
              changeFrequency(
                Number(event.target.value) as Draft['frequencyPerWeek'],
              )
            }
            className={fieldClass}
          >
            {FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-ink">
          <span className="mb-1 block text-xs text-muted">
            {t('catalog.focus')}
          </span>
          <select
            value={draft.accent}
            onChange={(event) =>
              update({ ...draft, accent: event.target.value as ProgramAccent })
            }
            className={fieldClass}
          >
            {ACCENTS.map((accent) => (
              <option key={accent} value={accent}>
                {t(`catalog.accents.${accent}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {draft.days.map((day, dayIndex) => (
        <section
          key={dayIndex}
          className="rounded-lg border border-line bg-panel p-4"
        >
          <h2 className="font-heading text-xl text-ink">
            {t('day', { day: dayIndex + 1 })}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {day.exercises.map((exercise, exerciseIndex) => (
              <div
                key={`${dayIndex}-${exerciseIndex}`}
                className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
              >
                <ExerciseSearch
                  exercises={exercises}
                  value={exercise.exerciseId}
                  onSelect={(option) =>
                    replaceExercise(
                      draft,
                      dayIndex,
                      exerciseIndex,
                      {
                        ...exercise,
                        exerciseId: option.id,
                        repsMin: option.repsMin,
                        repsMax: option.repsMax,
                      },
                      update,
                    )
                  }
                />
                <NumberField
                  label={t('catalog.sets')}
                  value={exercise.sets}
                  onChange={(sets) =>
                    replaceExercise(
                      draft,
                      dayIndex,
                      exerciseIndex,
                      {
                        ...exercise,
                        sets,
                      },
                      update,
                    )
                  }
                />
                <NumberField
                  label={t('catalog.repsMin')}
                  value={exercise.repsMin}
                  onChange={(repsMin) =>
                    replaceExercise(
                      draft,
                      dayIndex,
                      exerciseIndex,
                      {
                        ...exercise,
                        repsMin,
                      },
                      update,
                    )
                  }
                />
                <NumberField
                  label={t('catalog.repsMax')}
                  value={exercise.repsMax}
                  onChange={(repsMax) =>
                    replaceExercise(
                      draft,
                      dayIndex,
                      exerciseIndex,
                      {
                        ...exercise,
                        repsMax,
                      },
                      update,
                    )
                  }
                />
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={exercise.allowsAbsAddon}
                    onChange={(event) =>
                      replaceExercise(
                        draft,
                        dayIndex,
                        exerciseIndex,
                        {
                          ...exercise,
                          allowsAbsAddon: event.target.checked,
                        },
                        update,
                      )
                    }
                  />
                  {t('catalog.abs')}
                </label>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={day.exercises.length === 1}
                    onClick={() => {
                      const days = draft.days.map((item, index) =>
                        index === dayIndex
                          ? {
                              exercises: item.exercises.filter(
                                (_, rowIndex) => rowIndex !== exerciseIndex,
                              ),
                            }
                          : item,
                      );
                      update({ ...draft, days });
                    }}
                  >
                    {t('catalog.removeExercise')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-lg"
            onClick={() => {
              const days = draft.days.map((item, index) =>
                index === dayIndex
                  ? {
                      exercises: [...item.exercises, blankExercise(fallback)],
                    }
                  : item,
              );
              update({ ...draft, days });
            }}
          >
            {t('catalog.addExercise')}
          </Button>
        </section>
      ))}

      {repsError ? (
        <p role="alert" className="text-sm text-amber">
          {repsError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-amber">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="sm"
        className="w-fit rounded-lg"
        disabled={pending}
      >
        {pending ? t('catalog.saving') : t('catalog.save')}
      </Button>
    </form>
  );
}

function matchesExercise(
  exercise: ExerciseResponse,
  query: string,
  locale: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [exerciseName(exercise, locale), exercise.name, exercise.nameEn].some(
    (name) => name.toLocaleLowerCase().includes(needle),
  );
}

function ExerciseSearch({
  exercises,
  value,
  onSelect,
}: {
  exercises: ExerciseResponse[];
  value: string;
  onSelect: (exercise: ExerciseResponse) => void;
}) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = exercises.find((exercise) => exercise.id === value);
  const matches = exercises.filter((exercise) =>
    matchesExercise(exercise, query, locale),
  );
  const boundedIndex = Math.min(activeIndex, Math.max(matches.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  function choose(exercise: ExerciseResponse) {
    onSelect(exercise);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={rootRef} className="relative text-sm text-ink sm:col-span-2">
      <span className="mb-1 block text-xs text-muted">
        {t('catalog.exercise')}
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left`}
        onClick={() => {
          setActiveIndex(0);
          setOpen((current) => !current);
        }}
      >
        <span className="truncate">
          {selected
            ? exerciseName(selected, locale)
            : t('catalog.searchExercise')}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-line bg-panel p-2 shadow-overlay">
          <input
            ref={searchRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            aria-label={t('catalog.searchExercise')}
            placeholder={t('catalog.searchExercise')}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) =>
                  matches.length === 0
                    ? 0
                    : Math.min(index + 1, matches.length - 1),
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const match = matches[boundedIndex];
                if (match) choose(match);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
            className={fieldClass}
          />
          <ul
            id={listId}
            role="listbox"
            className="mt-2 max-h-60 overflow-auto"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-muted">
                {t('catalog.noExerciseMatch')}
              </li>
            ) : (
              matches.map((option, index) => (
                <li key={option.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    className={`block w-full rounded-md px-3 py-2 text-left ${
                      index === boundedIndex
                        ? 'bg-accent text-background'
                        : 'text-ink hover:bg-line'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                  >
                    {exerciseName(option, locale)}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function replaceExercise(
  draft: Draft,
  dayIndex: number,
  exerciseIndex: number,
  next: DraftExercise,
  update: (draft: Draft) => void,
) {
  update({
    ...draft,
    days: draft.days.map((day, index) =>
      index === dayIndex
        ? {
            exercises: day.exercises.map((exercise, rowIndex) =>
              rowIndex === exerciseIndex ? next : exercise,
            ),
          }
        : day,
    ),
  });
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm text-ink">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        required
        type="number"
        min={1}
        max={999}
        value={value}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          onChange(Number.isFinite(next) ? next : 1);
        }}
        className={fieldClass}
      />
    </label>
  );
}
