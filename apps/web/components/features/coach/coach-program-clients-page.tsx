'use client';

import type { CoachClientSummary } from '@repo/shared-types';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { useProgramClients } from '@/lib/hooks/use-coach-clients';
import { programCatalogName } from '@/lib/program-catalog-name';

export function CoachProgramClientsPage({
  templateId,
}: {
  templateId: string;
}) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const clients = useProgramClients(templateId);
  const [search, setSearch] = useState('');
  const visible = useMemo(
    () => filterClients(clients.data?.clients ?? [], search),
    [clients.data, search],
  );
  const missing =
    clients.error instanceof ApiClientError && clients.error.status === 404;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <Link
        href="/coach/programs"
        className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t('catalog.back')}
      </Link>
      <h1 className="mt-4 font-heading text-3xl leading-none text-ink">
        {clients.data
          ? programCatalogName({ name: clients.data.programName })
          : t('catalog.assignedClients')}
      </h1>
      {clients.data ? (
        <p className="mt-2 text-sm text-muted">
          {t('count', { count: clients.data.clients.length })}
        </p>
      ) : null}

      {clients.isPending ? (
        <div aria-busy="true" className="mt-8 flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      {missing ? (
        <p className="mt-8 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
          {t('catalog.notFound')}
        </p>
      ) : null}

      {clients.isError && !missing ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p role="alert" className="text-sm text-amber">
            {t('catalog.assigneesError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg whitespace-nowrap"
            onClick={() => void clients.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {clients.data && clients.data.clients.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
          {t('catalog.assigneesEmpty')}
        </p>
      ) : null}

      {clients.data && clients.data.clients.length > 0 ? (
        <>
          <input
            type="search"
            value={search}
            aria-label={t('searchClients')}
            placeholder={t('searchClients')}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-6 h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {visible.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
              {t('searchEmpty')}
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-line bg-panel">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="hidden border-b border-line text-xs text-muted sm:table-header-group">
                  <tr>
                    <th className="px-4 py-3 font-medium" scope="col">
                      {t('name')}
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      {t('email')}
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      {t('lastWorkout')}
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      {t('roster')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((client) => (
                    <tr
                      key={client.id}
                      className="block border-b border-line px-4 py-4 last:border-b-0 sm:table-row sm:px-0 sm:py-0"
                    >
                      <th
                        className="block font-medium text-ink sm:table-cell sm:px-4 sm:py-3"
                        scope="row"
                      >
                        <Link
                          href={`/coach/clients/${client.id}`}
                          className="underline decoration-line underline-offset-4 hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {client.name?.trim() ? client.name : t('unnamed')}
                        </Link>
                      </th>
                      <td className="mt-3 block break-all sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
                        {client.email}
                      </td>
                      <td className="mt-3 block text-muted sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
                        {client.lastWorkoutAt
                          ? formatDay(locale, client.lastWorkoutAt)
                          : t('noWorkout')}
                      </td>
                      <td className="mt-3 block text-muted sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
                        {client.archived
                          ? t('archived')
                          : t('catalog.clientActive')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}

function filterClients(clients: CoachClientSummary[], search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return clients;
  return clients.filter((client) => {
    const name = client.name?.toLowerCase() ?? '';
    return name.includes(needle) || client.email.toLowerCase().includes(needle);
  });
}

function formatDay(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
