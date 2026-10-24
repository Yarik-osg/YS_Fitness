'use client';

import type {
  AssignedProgramResponse,
  ProgramDayResponse,
} from '@repo/shared-types';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Collapse } from '@/components/ui/collapse';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignProgramCard } from '@/components/features/dashboard/dashboard';
import { ClientNav } from '@/components/features/shell/client-nav';
import { TrainingCalendar } from '@/components/features/training/training-calendar';
import { Link } from '@/i18n/navigation';
import { exerciseName } from '@/lib/exercise-name';
import { useProgramTitle } from '@/lib/program-title';
import { useMyProgram } from '@/lib/hooks/use-programs';

export function TrainingPage() {
  const program = useMyProgram();
  const t = useTranslations('training');

  if (program.isPending && !program.data) {
    return <TrainingLoading label={t('loading')} />;
  }

  if (!program.data) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background px-4 pt-8 pb-24 text-white">
        <PageHeader />
        <div className="pt-6">
          <AssignProgramCard program={program} />
        </div>
        <ClientNav active="training" />
      </div>
    );
  }

  return <ProgramDays program={program.data} />;
}

function TrainingLoading({ label }: { label: string }) {
  return (
    <main
      aria-busy="true"
      aria-label={label}
      className="mx-auto min-h-screen w-full max-w-[430px] bg-background px-4 pt-8 pb-24"
    >
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-2 w-20" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="mb-3 h-20 w-full" />
      <Skeleton className="mb-3 h-16 w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <ClientNav active="training" />
    </main>
  );
}

function ProgramDays({ program }: { program: AssignedProgramResponse }) {
  const home = useTranslations('dashboard.home');
  const programTitle = useProgramTitle(program.accent);
  const days = [...program.days].sort(
    (left, right) => left.dayNumber - right.dayNumber,
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-24 text-white">
      <PageHeader />
      <div className="flex flex-col gap-3 px-4 pt-4">
        <section className="border-[1.5px] border-lime/15 bg-lime/4 px-[18px] py-5">
          <h2 className="font-heading text-[22px] leading-tight break-words text-lime">
            {programTitle}
          </h2>
          <p className="mt-2 text-xs text-white/55">
            {home(`levels.${program.level}`)}
            {' · '}
            {home('timesShort', { count: program.frequencyPerWeek })}
          </p>
        </section>
        <TrainingCalendar
          frequencyPerWeek={program.frequencyPerWeek}
          assignedAt={program.assignedAt}
        />
        {days.map((day) => (
          <DayCard
            key={day.dayNumber}
            day={day}
            count={
              program.dayLogCounts.find(
                (entry) => entry.dayNumber === day.dayNumber,
              )?.count ?? 0
            }
            isNext={day.dayNumber === program.nextDayNumber}
          />
        ))}
      </div>
      <ClientNav active="training" />
    </div>
  );
}

function PageHeader() {
  const t = useTranslations('training');

  return (
    <header className="border-b border-white/5 px-5 pt-8 pb-5">
      <h1 className="font-heading text-[28px] leading-none text-white uppercase">
        {t('title')}
      </h1>
    </header>
  );
}

function DayCard({
  day,
  count,
  isNext,
}: {
  day: ProgramDayResponse;
  count: number;
  isNext: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('training');
  const muscles = useTranslations('dashboard.workouts');
  const [expanded, setExpanded] = useState(isNext);
  const number = String(day.dayNumber).padStart(2, '0');
  const focus = muscleFocus(day, muscles);
  const panelId = `training-day-${day.dayNumber}`;

  return (
    <article
      className={
        isNext
          ? 'border-[1.5px] border-teal/35 bg-teal/4'
          : 'border-[1.5px] border-white/[0.07] bg-white/[0.015]'
      }
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left ${
          expanded ? 'border-b border-white/5' : ''
        }`}
        onClick={() => setExpanded((open) => !open)}
      >
        <span>
          {isNext ? (
            <span className="mb-1 block font-label text-[7px] font-semibold tracking-[0.16em] text-teal uppercase">
              {t('next')}
            </span>
          ) : null}
          <h2 className="font-heading text-base tracking-[0.04em] text-white uppercase">
            {t('dayTitle', { number })}
          </h2>
          {focus ? (
            <span className="mt-1 block font-heading text-[13px] tracking-[0.04em] text-white/55 uppercase">
              {focus}
            </span>
          ) : null}
          <span className="mt-1 block text-[11px] font-medium text-white/45">
            {t('completedTimes', { count })}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-heading text-[22px] leading-none text-lime">
            {day.exercises.length}
          </span>
          <span className="mt-1 block font-label text-[7px] font-semibold tracking-[0.1em] text-white/25 uppercase">
            {t('exercises')}
          </span>
        </span>
      </button>
      <Collapse open={expanded} id={panelId}>
        <div>
          <ul>
            {day.exercises.map((row, index) => (
              <li
                key={row.exercise.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  index < day.exercises.length - 1
                    ? 'border-b border-white/[0.03]'
                    : ''
                }`}
              >
                <span className="w-6 font-heading text-[11px] text-white/20">
                  {String(row.order).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-white/70">
                    {exerciseName(row.exercise, locale)}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium text-white/30">
                    {row.exercise.muscleGroups
                      .map((group) => muscles(`muscles.${group}`))
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-white/35">
                  {muscles('prescription', {
                    sets: row.sets,
                    repsMin: row.exercise.repsMin,
                    repsMax: row.exercise.repsMax,
                  })}
                </span>
              </li>
            ))}
          </ul>
          {isNext ? (
            <div className="px-4 pt-2 pb-4">
              <Link
                href="/workout"
                className={buttonVariants({ className: 'w-full' })}
              >
                {t('start')}
              </Link>
            </div>
          ) : null}
        </div>
      </Collapse>
    </article>
  );
}

function muscleFocus(
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
  return labels.join(' · ');
}
