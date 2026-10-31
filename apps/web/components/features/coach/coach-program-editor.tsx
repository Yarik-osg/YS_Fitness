'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import {
  createCoachProgram,
  updateCoachProgram,
} from '@/lib/api/coach-programs';
import {
  useCoachExercises,
  useCoachProgram,
} from '@/lib/hooks/use-coach-programs';
import { CoachProgramForm, coachProgramMessage } from './coach-program-form';

export function CoachProgramEditor({ templateId }: { templateId?: string }) {
  const t = useTranslations('coach');
  const router = useRouter();
  const queryClient = useQueryClient();
  const exercises = useCoachExercises();
  const template = useCoachProgram(templateId);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Parameters<typeof createCoachProgram>[0]) =>
      templateId
        ? updateCoachProgram(templateId, body)
        : createCoachProgram(body),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'program-templates'],
      });
      router.push(`/coach/programs/${saved.id}`);
    },
    onError: (caught) => setError(coachProgramMessage(caught, t)),
  });

  const missing =
    template.isError &&
    template.error instanceof ApiClientError &&
    template.error.status === 404;
  const system = template.data?.origin === 'SYSTEM';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <Link
        href="/coach/programs"
        className="text-sm text-muted hover:text-ink"
      >
        {t('catalog.back')}
      </Link>
      <h1 className="mt-4 font-heading text-3xl leading-none text-ink">
        {templateId ? t('catalog.editTitle') : t('catalog.createTitle')}
      </h1>

      {exercises.isPending || (templateId && template.isPending) ? (
        <div aria-busy="true" className="mt-8">
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : null}

      {exercises.isError || (template.isError && !missing) ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p role="alert" className="text-sm text-amber">
            {t('catalog.loadError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => {
              void exercises.refetch();
              if (templateId) void template.refetch();
            }}
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

      {system && template.data ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p className="text-sm text-muted">{t('catalog.readOnly')}</p>
          <Link
            href={`/coach/programs/${template.data.id}`}
            className="text-sm text-ink underline-offset-4 hover:underline"
          >
            {template.data.name}
          </Link>
        </div>
      ) : null}

      {exercises.data && exercises.data.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t('catalog.empty')}</p>
      ) : null}

      {exercises.data &&
      exercises.data.length > 0 &&
      (!templateId || template.data?.origin === 'TRAINER') ? (
        <CoachProgramForm
          exercises={exercises.data}
          template={template.data}
          pending={save.isPending}
          error={error}
          onSubmit={(body) => {
            setError(null);
            save.mutate(body);
          }}
          onCancel={() =>
            router.push(
              templateId ? `/coach/programs/${templateId}` : '/coach/programs',
            )
          }
        />
      ) : null}
    </main>
  );
}
