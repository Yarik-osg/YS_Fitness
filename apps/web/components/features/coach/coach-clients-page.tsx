'use client';

import type { CoachClientSummary } from '@repo/shared-types';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import {
  useArchiveClient,
  useCoachClients,
} from '@/lib/hooks/use-coach-clients';
import { programCatalogName } from '@/lib/program-catalog-name';

export function CoachClientsPage() {
  const t = useTranslations('coach');
  const locale = useLocale();
  const clients = useCoachClients();
  const archive = useArchiveClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const inView = useMemo(
    () =>
      (clients.data?.clients ?? []).filter((client) =>
        view === 'archived' ? client.archived : !client.archived,
      ),
    [clients.data, view],
  );
  const visible = useMemo(
    () => filterClients(inView, search),
    [inView, search],
  );
  const pending = inView.find((client) => client.id === pendingId) ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <h1 className="font-heading text-3xl leading-none text-ink">
        {t('title')}
      </h1>
      {clients.data ? (
        <p className="mt-2 text-sm text-muted">
          {t('count', { count: inView.length })}
        </p>
      ) : null}

      {clients.isPending ? (
        <div aria-busy="true" className="mt-8 flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      {clients.isError ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p role="alert" className="text-sm text-amber">
            {t('loadError')}
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
          {t('empty')}
        </p>
      ) : null}

      {clients.data && clients.data.clients.length > 0 ? (
        <>
          <div className="mt-6 flex gap-2">
            <Button
              size="sm"
              variant={view === 'active' ? 'primary' : 'outline'}
              className="rounded-lg"
              aria-pressed={view === 'active'}
              onClick={() => {
                setView('active');
                setPendingId(null);
                archive.reset();
              }}
            >
              {t('rosterActive')}
            </Button>
            <Button
              size="sm"
              variant={view === 'archived' ? 'primary' : 'outline'}
              className="rounded-lg"
              aria-pressed={view === 'archived'}
              onClick={() => {
                setView('archived');
                setPendingId(null);
                archive.reset();
              }}
            >
              {t('rosterArchived')}
            </Button>
          </div>
          <input
            type="search"
            value={search}
            aria-label={t('searchClients')}
            placeholder={t('searchClients')}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-4 h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {pending ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-line bg-panel px-4 py-3">
              <p className="text-sm text-ink">
                {t('archiveConfirm', {
                  name: pending.name?.trim() ? pending.name : t('unnamed'),
                })}
              </p>
              <p className="text-sm text-muted">{t('archiveBody')}</p>
              {archive.isError ? (
                <p role="alert" className="text-sm text-amber">
                  {t('archiveError')}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-lg"
                  disabled={archive.isPending}
                  onClick={() => archive.mutate(pending.id)}
                >
                  {archive.isPending ? t('archiving') : t('archive')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={archive.isPending}
                  onClick={() => {
                    setPendingId(null);
                    archive.reset();
                  }}
                >
                  {t('archiveCancel')}
                </Button>
              </div>
            </div>
          ) : null}
          {inView.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
              {view === 'archived' ? t('archivedEmpty') : t('activeEmpty')}
            </p>
          ) : visible.length === 0 ? (
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
                      {t('joined')}
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      {t('program')}
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      {t('lastWorkout')}
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      {t('subscription')}
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      <span className="sr-only">{t('archive')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((client) => (
                    <ClientRow
                      key={client.id}
                      client={client}
                      locale={locale}
                      busy={archive.isPending}
                      onArchive={
                        client.archived
                          ? null
                          : () => {
                              if (archive.isPending) return;
                              archive.reset();
                              setPendingId(client.id);
                            }
                      }
                    />
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

function ClientRow({
  client,
  locale,
  onArchive,
  busy,
}: {
  client: CoachClientSummary;
  locale: string;
  onArchive: (() => void) | null;
  busy: boolean;
}) {
  const t = useTranslations('coach');
  const joined = formatDay(locale, client.createdAt);

  return (
    <tr className="block border-b border-line px-4 py-4 last:border-b-0 motion-safe:transition-colors sm:table-row sm:px-0 sm:py-0 sm:hover:bg-[var(--color-wash)]">
      <th
        className="block font-medium text-ink sm:table-cell sm:px-4 sm:py-3"
        scope="row"
      >
        <Link
          href={`/coach/clients/${client.id}`}
          className="underline decoration-line underline-offset-4 hover:text-teal hover:decoration-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors"
        >
          {client.name?.trim() ? client.name : t('unnamed')}
        </Link>
      </th>
      <td className="mt-3 block break-all text-ink sm:mt-0 sm:table-cell sm:break-normal sm:px-4 sm:py-3">
        <span className="mb-0.5 block text-xs text-muted sm:hidden">
          {t('email')}
        </span>
        {client.email}
      </td>
      <td className="mt-3 block text-muted sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
        <span className="mb-0.5 block text-xs text-muted sm:hidden">
          {t('joined')}
        </span>
        {joined}
      </td>
      <td className="mt-3 block text-ink sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
        <span className="mb-0.5 block text-xs text-muted sm:hidden">
          {t('program')}
        </span>
        {client.programName ? (
          programCatalogName({ name: client.programName })
        ) : (
          <span className="text-muted">{t('programMissing')}</span>
        )}
      </td>
      <td className="mt-3 block text-muted sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
        <span className="mb-0.5 block text-xs text-muted sm:hidden">
          {t('lastWorkout')}
        </span>
        {client.lastWorkoutAt
          ? formatDay(locale, client.lastWorkoutAt)
          : t('noWorkout')}
      </td>
      <td className="mt-3 block sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
        <Status
          label={t('subscription')}
          on={client.subscriptionActive}
          yes={t('subscriptionActive')}
          no={
            client.subscriptionOnFile
              ? t('subscriptionInactive')
              : t('noSubscription')
          }
        />
      </td>
      <td className="mt-3 block sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
        {client.archived ? (
          <span className="text-xs text-muted">{t('archived')}</span>
        ) : onArchive ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            aria-label={t('archiveNamed', {
              name: client.name?.trim() ? client.name : t('unnamed'),
            })}
            disabled={busy}
            onClick={onArchive ?? undefined}
          >
            {t('archive')}
          </Button>
        ) : null}
      </td>
    </tr>
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

function Status({
  label,
  on,
  yes,
  no,
}: {
  label: string;
  on: boolean;
  yes: string;
  no: string;
}) {
  return (
    <span className="inline-flex flex-col gap-1 sm:items-start">
      <span className="text-xs text-muted sm:hidden">{label}</span>
      <span
        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs ${
          on ? 'bg-lime/10 text-lime' : 'text-muted'
        }`}
      >
        {on ? yes : no}
      </span>
    </span>
  );
}
