'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import {
  deleteCoachProgram,
  duplicateCoachProgram,
} from '@/lib/api/coach-programs';
import { exerciseName } from '@/lib/exercise-name';
import { useCoachProgram } from '@/lib/hooks/use-coach-programs';
import { cn } from '@/lib/utils';
import { coachProgramMessage } from './coach-program-form';

export function CoachProgramPage({ templateId }: { templateId: string }) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const program = useCoachProgram(templateId);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const duplicate = useMutation({
    mutationFn: () => duplicateCoachProgram(templateId),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'program-templates'],
      });
      router.push(`/coach/programs/${created.id}`);
    },
    onError: (caught) => setError(coachProgramMessage(caught, t)),
  });
  const remove = useMutation({
    mutationFn: () => deleteCoachProgram(templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'program-templates'],
      });
      router.push('/coach/programs');
    },
    onError: (caught) => setError(coachProgramMessage(caught, t)),
  });
  const missing =
    program.isError &&
    program.error instanceof ApiClientError &&
    program.error.status === 404;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <Link
        href="/coach/programs"
        className="text-sm text-muted hover:text-ink"
      >
        {t('catalog.back')}
      </Link>

      {program.isPending ? (
        <div aria-busy="true" className="mt-8">
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : null}

      {program.isError && !missing ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p role="alert" className="text-sm text-amber">
            {t('catalog.loadError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => void program.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {missing ? (
        <p role="alert" className="mt-8 text-sm text-amber">
          {t('catalog.notFound')}
        </p>
      ) : null}

      {program.data ? (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted">
                {program.data.origin === 'SYSTEM'
                  ? t('catalog.system')
                  : t('catalog.custom')}
              </p>
              <h1 className="mt-2 font-heading text-3xl leading-none text-ink">
                {program.data.name}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {t(`catalog.levels.${program.data.level}`)}
                {' · '}
                {t(`catalog.accents.${program.data.accent}`)}
                {' · '}
                {program.data.frequencyPerWeek}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-lg"
                disabled={duplicate.isPending}
                onClick={() => {
                  setError(null);
                  duplicate.mutate();
                }}
              >
                {duplicate.isPending
                  ? t('catalog.duplicating')
                  : t('catalog.duplicate')}
              </Button>
              {program.data.origin === 'TRAINER' ? (
                <>
                  <Link
                    href={`/coach/programs/${program.data.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'rounded-lg',
                    )}
                  >
                    {t('catalog.edit')}
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setConfirmDelete(true)}
                  >
                    {t('catalog.delete')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {confirmDelete ? (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3">
              <p className="text-sm text-ink">{t('catalog.deleteConfirm')}</p>
              <Button
                size="sm"
                className="rounded-lg"
                disabled={remove.isPending}
                onClick={() => {
                  setError(null);
                  remove.mutate();
                }}
              >
                {remove.isPending ? t('catalog.deleting') : t('catalog.delete')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setConfirmDelete(false)}
              >
                {t('catalog.cancel')}
              </Button>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-amber">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-4">
            {program.data.days.map((day) => (
              <section
                key={day.dayNumber}
                className="rounded-lg border border-line bg-panel p-4"
              >
                <h2 className="font-heading text-xl text-ink">
                  {t('day', { day: day.dayNumber })}
                </h2>
                <ol className="mt-3 flex flex-col gap-2 text-sm">
                  {day.exercises.map((row) => (
                    <li key={row.order} className="text-ink">
                      {exerciseName(row.exercise, locale)}
                      <span className="text-muted">
                        {' · '}
                        {row.sets} × {row.exercise.repsMin}–
                        {row.exercise.repsMax}
                        {row.allowsAbsAddon ? ` · ${t('catalog.abs')}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
