'use client';

import type { WorkoutLogResponse } from '@repo/shared-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Collapse } from '@/components/ui/collapse';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addMonths,
  dayRange,
  groupByLocalDay,
  isSameMonth,
  localDateKey,
  monthGrid,
  startOfDay,
  startOfMonth,
  weekDays,
} from '@/lib/calendar';
import { exerciseName } from '@/lib/exercise-name';
import { useWorkoutCalendar } from '@/lib/hooks/use-workouts';
import { isRecommendedDay } from '@/lib/training-schedule';

// Fade the swapped week/month view in; no layout animation, so nothing clips.
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.18 },
} as const;

const LIME = 'bg-[#c8ff2e]';

export function TrainingCalendar({
  frequencyPerWeek,
  assignedAt,
}: {
  /** With `assignedAt`, marks the recommended training weekdays. */
  frequencyPerWeek?: number;
  assignedAt?: string;
} = {}) {
  const locale = useLocale();
  const t = useTranslations('training.calendar');
  const today = new Date();
  const todayKey = localDateKey(today);
  const schedule =
    frequencyPerWeek != null && assignedAt != null
      ? { frequencyPerWeek, assignedAt }
      : undefined;
  const [monthOpen, setMonthOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const week = weekDays(today);
  const weekRange = dayRange(week[0]!, week[6]!);
  const grid = useMemo(() => monthGrid(viewMonth), [viewMonth]);
  const monthRange = dayRange(grid[0]!, grid.at(-1)!);
  const weekQuery = useWorkoutCalendar(weekRange);
  const monthQuery = useWorkoutCalendar({ ...monthRange, enabled: monthOpen });
  const activeQuery = monthOpen ? monthQuery : weekQuery;

  const weekLogs = weekQuery.data?.logs;
  const monthLogs = monthOpen ? monthQuery.data?.logs : undefined;
  const logsByDay = useMemo(() => {
    const unique = new Map<string, WorkoutLogResponse>();
    for (const log of [...(weekLogs ?? []), ...(monthLogs ?? [])]) {
      unique.set(log.id, log);
    }
    return groupByLocalDay([...unique.values()]);
  }, [weekLogs, monthLogs]);

  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
  });
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const selectedLogs = logsByDay.get(localDateKey(selected)) ?? [];
  const nextMonthDisabled =
    viewMonth.getTime() >= startOfMonth(today).getTime();

  function toggleMonth() {
    const now = new Date();
    setMonthOpen((open) => !open);
    setViewMonth(startOfMonth(now));
    setSelected(startOfDay(now));
  }

  function goToMonth(delta: number) {
    const now = new Date();
    const next = addMonths(viewMonth, delta);
    setViewMonth(next);
    setSelected(isSameMonth(next, now) ? startOfDay(now) : next);
  }

  function cellLabel(date: Date) {
    const count = logsByDay.get(localDateKey(date))?.length ?? 0;
    const label = `${dayFormat.format(date)}, ${t('workoutCount', { count })}`;
    return isRecommendedDay(date, schedule)
      ? `${label}, ${t('recommended')}`
      : label;
  }

  const selectedRecommended = isRecommendedDay(selected, schedule);
  const selectedInFuture =
    startOfDay(selected).getTime() > startOfDay(today).getTime();

  return (
    <section aria-label={t('title')}>
      <div className="mb-2.5 flex min-h-[18px] items-center justify-between gap-3">
        {monthOpen ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('previousMonth')}
              className="grid size-[18px] place-items-center text-white/50"
              onClick={() => goToMonth(-1)}
            >
              <ChevronLeft size={14} />
            </button>
            <p
              aria-live="polite"
              className="min-w-[110px] text-center font-label text-[9px] font-bold tracking-[0.16em] text-white/60 uppercase"
            >
              {new Intl.DateTimeFormat(locale, { month: 'long' }).format(
                viewMonth,
              )}{' '}
              {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              aria-label={t('nextMonth')}
              disabled={nextMonthDisabled}
              className="grid size-[18px] place-items-center text-white/50 disabled:opacity-25"
              onClick={() => goToMonth(1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <p className="font-label text-[7px] font-bold tracking-[0.16em] text-white/[0.28] uppercase">
            {t('title')}
          </p>
        )}
        <button
          type="button"
          aria-expanded={monthOpen}
          className="font-label text-[8px] font-bold tracking-[0.14em] text-[#35f5e8] uppercase"
          onClick={toggleMonth}
        >
          {monthOpen ? t('showWeek') : t('showMonth')}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {monthOpen ? (
          <m.div key="month" {...fadeIn}>
            <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
              {week.map((day) => (
                <span
                  key={day.getDay()}
                  className="text-center font-label text-[7px] font-semibold tracking-[0.08em] text-white/30 uppercase"
                >
                  {weekdayShort.format(day)}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day) => {
                const key = localDateKey(day);
                return (
                  <DayButton
                    key={key}
                    label={cellLabel(day)}
                    isToday={key === todayKey}
                    isSelected={key === localDateKey(selected)}
                    hasWorkout={(logsByDay.get(key)?.length ?? 0) > 0}
                    isRecommended={isRecommendedDay(day, schedule)}
                    dimmed={!isSameMonth(day, viewMonth)}
                    onSelect={() => setSelected(day)}
                  >
                    <span className="font-heading text-[13px] leading-none">
                      {day.getDate()}
                    </span>
                  </DayButton>
                );
              })}
            </div>
          </m.div>
        ) : (
          <m.div key="week" className="flex gap-1.5" {...fadeIn}>
            {week.map((day) => {
              const key = localDateKey(day);
              return (
                <DayButton
                  key={key}
                  label={cellLabel(day)}
                  isToday={key === todayKey}
                  isSelected={key === localDateKey(selected)}
                  hasWorkout={(logsByDay.get(key)?.length ?? 0) > 0}
                  isRecommended={isRecommendedDay(day, schedule)}
                  onSelect={() => setSelected(day)}
                >
                  <span className="font-label text-[7px] font-semibold tracking-[0.08em] uppercase">
                    {weekdayShort.format(day)}
                  </span>
                </DayButton>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>

      <div
        aria-live="polite"
        aria-busy={activeQuery.isPending}
        className="mt-3 border-[1.5px] border-white/[0.07] bg-white/[0.015]"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="font-heading text-sm tracking-[0.04em] text-white/70 uppercase">
            {new Intl.DateTimeFormat(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(selected)}
          </p>
          {selectedRecommended ? (
            <span className="shrink-0 font-label text-[7px] font-semibold tracking-[0.16em] text-[#35f5e8] uppercase">
              {t('recommended')}
            </span>
          ) : null}
        </div>
        {activeQuery.isError ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3">
            <p className="text-xs text-white/50">{t('loadError')}</p>
            <button
              type="button"
              disabled={activeQuery.isFetching}
              className="font-label text-[8px] font-bold tracking-[0.14em] text-[#35f5e8] uppercase disabled:opacity-40"
              onClick={() => void activeQuery.refetch()}
            >
              {t('retry')}
            </button>
          </div>
        ) : selectedLogs.length > 0 ? (
          selectedLogs.map((log) => <LoggedWorkout key={log.id} log={log} />)
        ) : activeQuery.isPending ? (
          <div className="flex flex-col gap-2 border-t border-white/5 px-4 py-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : selectedInFuture ? null : (
          <p className="border-t border-white/5 px-4 py-3 text-xs text-white/40">
            {t('empty')}
          </p>
        )}
      </div>
    </section>
  );
}

function DayButton({
  label,
  isToday,
  isSelected,
  hasWorkout,
  isRecommended,
  dimmed = false,
  onSelect,
  children,
}: {
  label: string;
  isToday: boolean;
  isSelected: boolean;
  hasWorkout: boolean;
  isRecommended: boolean;
  dimmed?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const tone = isToday
    ? 'text-[#c8ff2e]'
    : dimmed
      ? 'text-white/20'
      : isRecommended
        ? 'text-white/75'
        : 'text-white/45';
  const frame = isSelected
    ? 'border-[rgba(200,255,46,0.6)] bg-[rgba(200,255,46,0.08)]'
    : isToday
      ? 'border-[rgba(200,255,46,0.3)] bg-[rgba(200,255,46,0.04)]'
      : isRecommended
        ? 'border-[rgba(53,245,232,0.28)] bg-[rgba(53,245,232,0.03)]'
        : 'border-white/[0.06] bg-white/[0.02]';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 border px-1 py-2.5 ${frame} ${tone}`}
      onClick={onSelect}
    >
      {children}
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          hasWorkout
            ? LIME
            : isRecommended
              ? 'border border-[#35f5e8]/70'
              : dimmed
                ? 'bg-white/[0.04]'
                : 'bg-white/[0.08]'
        }`}
      />
    </button>
  );
}

function LoggedWorkout({ log }: { log: WorkoutLogResponse }) {
  const locale = useLocale();
  const t = useTranslations('training.calendar');
  const sets = useTranslations('workouts.completion');
  const program = useTranslations('training');
  const [expanded, setExpanded] = useState(false);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(log.completedAt));

  const exercises: {
    key: string;
    exercise: WorkoutLogResponse['sets'][number]['exercise'];
    sets: WorkoutLogResponse['sets'];
  }[] = [];
  for (const set of log.sets) {
    const key = `${set.exerciseId}:${set.order}`;
    const existing = exercises.find((entry) => entry.key === key);
    if (existing) existing.sets.push(set);
    else exercises.push({ key, exercise: set.exercise, sets: [set] });
  }

  const panelId = `calendar-log-${log.id}`;

  return (
    <div className="border-t border-white/5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="font-label text-[8px] font-bold tracking-[0.14em] text-[#35f5e8] uppercase">
          {t('workout', {
            number: String(log.dayNumber).padStart(2, '0'),
            time,
          })}
        </span>
        <span className="text-right">
          <span className="block font-heading text-[18px] leading-none text-[#c8ff2e]">
            {exercises.length}
          </span>
          <span className="mt-1 block font-label text-[7px] font-semibold tracking-[0.1em] text-white/25 uppercase">
            {program('exercises')}
          </span>
        </span>
      </button>
      <Collapse open={expanded} id={panelId}>
        <ul className="space-y-1.5 px-4 pb-3">
          {exercises.map((exercise) => (
            <li
              key={exercise.key}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0 text-xs font-medium text-white/70">
                {exerciseName(exercise.exercise, locale)}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-white/40">
                {exercise.sets
                  .map((set) =>
                    set.weightKg == null
                      ? sets('repsSummary', {
                          reps: String(set.repsCompleted),
                        })
                      : sets('setSummary', {
                          weight: String(set.weightKg),
                          reps: String(set.repsCompleted),
                        }),
                  )
                  .join(' • ')}
              </span>
            </li>
          ))}
        </ul>
      </Collapse>
    </div>
  );
}
