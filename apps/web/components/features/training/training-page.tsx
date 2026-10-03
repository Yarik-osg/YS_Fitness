'use client';

import type {
  AssignedProgramResponse,
  ProgramDayResponse,
} from '@repo/shared-types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { AssignProgramCard } from '@/components/features/dashboard/dashboard';
import { ClientNav } from '@/components/features/shell/client-nav';
import { Link } from '@/i18n/navigation';
import { useMyProgram } from '@/lib/hooks/use-programs';

export function TrainingPage() {
  const program = useMyProgram();
  const t = useTranslations('training');

  if (program.isPending && !program.data) {
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

  if (!program.data) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#0b0b0b] px-4 pt-8 pb-24 text-white">
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

function ProgramDays({ program }: { program: AssignedProgramResponse }) {
  const t = useTranslations('training');
  const days = [...program.days].sort(
    (left, right) => left.dayNumber - right.dayNumber,
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#0b0b0b] pb-24 text-white">
      <PageHeader />
      <div className="flex flex-col gap-3 px-4 pt-4">
        <section className="border-[1.5px] border-[rgba(200,255,46,0.15)] bg-[rgba(200,255,46,0.04)] px-[18px] py-5">
          <p className="mb-2 font-label text-[7px] font-semibold tracking-[0.18em] text-white/30 uppercase">
            {t('program')}
          </p>
          <h2 className="font-heading text-[22px] leading-tight tracking-[0.04em] break-words text-[#c8ff2e] uppercase">
            {program.templateName}
          </h2>
        </section>
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
      <p className="mb-1.5 font-label text-[8px] font-semibold tracking-[0.2em] text-[rgba(200,255,46,0.6)] uppercase">
        {t('brand')}
      </p>
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
          ? 'border-[1.5px] border-[rgba(53,245,232,0.35)] bg-[rgba(53,245,232,0.04)]'
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
            <span className="mb-1 block font-label text-[7px] font-semibold tracking-[0.16em] text-[#35f5e8] uppercase">
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
          <span className="block font-heading text-[22px] leading-none text-[#c8ff2e]">
            {day.exercises.length}
          </span>
          <span className="mt-1 block font-label text-[7px] font-semibold tracking-[0.1em] text-white/25 uppercase">
            {t('exercises')}
          </span>
        </span>
      </button>
      {expanded ? (
        <div id={panelId}>
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
                    {row.exercise.name}
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
                className={buttonVariants({
                  className: 'w-full text-[#0b0b0b]!',
                })}
              >
                {t('start')}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
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
