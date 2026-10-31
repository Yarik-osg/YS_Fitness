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
  renameCoachProgram,
} from '@/lib/api/coach-programs';
import { exerciseName } from '@/lib/exercise-name';
import { useCoachProgram } from '@/lib/hooks/use-coach-programs';
import { cn } from '@/lib/utils';
import { coachProgramMessage } from './coach-program-form';

export function CoachProgramPage({ templateId }: { templateId: string }) {
  const t = useTranslations('coach');
  const home = useTranslations('dashboard.home');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const program = useCoachProgram(templateId);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
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
  const rename = useMutation({
    mutationFn: () => renameCoachProgram(templateId, { name: name.trim() }),
    onSuccess: async () => {
      setRenaming(false);
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'program-templates'],
      });
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
    onError: (caught) =>
      setError(
        caught instanceof ApiClientError && caught.code === 'TEMPLATE_IN_USE'
          ? t('catalog.deleteInUse')
          : coachProgramMessage(caught, t),
      ),
  });
  const missing =
    program.isError &&
    program.error instanceof ApiClientError &&
    program.error.status === 404;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <Link
        href="/coach/programs"
        className="text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors"
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
                {home('timesShort', {
                  count: program.data.frequencyPerWeek,
                })}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      setError(null);
                      setConfirmDelete(false);
                      setName(program.data?.name ?? '');
                      setRenaming(true);
                    }}
                  >
                    {t('catalog.rename')}
                  </Button>
                  <Link
                    href={`/coach/programs/${program.data.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'rounded-lg',
                    )}
                  >
                    {t('catalog.edit')}
                  </Link>
                  {program.data.assignedCount === 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        setRenaming(false);
                        setConfirmDelete(true);
                      }}
                    >
                      {t('catalog.delete')}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {renaming ? (
            <form
              className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim() || rename.isPending) return;
                setError(null);
                rename.mutate();
              }}
            >
              <label
                className="shrink-0 text-sm text-ink"
                htmlFor="program-name"
              >
                {t('catalog.name')}
              </label>
              <input
                id="program-name"
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
                className="h-10 min-w-48 flex-1 rounded-lg border border-line bg-background px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  className="rounded-lg"
                  type="submit"
                  disabled={rename.isPending || name.trim().length === 0}
                >
                  {rename.isPending ? t('catalog.renaming') : t('catalog.save')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  type="button"
                  onClick={() => setRenaming(false)}
                >
                  {t('catalog.cancel')}
                </Button>
              </div>
            </form>
          ) : null}

          {confirmDelete ? (
            <div className="mt-6 flex flex-col items-start gap-3 border border-amber px-4 py-3">
              <p className="text-sm text-ink">
                {program.data.logCount > 0
                  ? t('catalog.deleteConfirmLogs')
                  : t('catalog.deleteConfirm')}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-amber text-amber hover:border-amber hover:bg-transparent hover:text-amber"
                  disabled={remove.isPending}
                  onClick={() => {
                    setError(null);
                    remove.mutate();
                  }}
                >
                  {remove.isPending
                    ? t('catalog.deleting')
                    : t('catalog.delete')}
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
