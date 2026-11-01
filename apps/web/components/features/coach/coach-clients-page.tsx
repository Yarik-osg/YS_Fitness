'use client';

import type { CoachClientSummary } from '@repo/shared-types';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { exportCoachTable } from '@/lib/api/coach';
import {
  useArchiveClient,
  useCoachClients,
  useRestoreClient,
} from '@/lib/hooks/use-coach-clients';
import { programCatalogName } from '@/lib/program-catalog-name';
import { exportDay, saveBlob } from '@/lib/save-blob';

export const QUIET_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const WORK_FILTERS = ['quiet', 'expired', 'unassigned'] as const;
type WorkFilter = (typeof WORK_FILTERS)[number];

export function missedRecentWorkout(
  lastWorkoutAt: string | null,
  now: number,
): boolean {
  if (lastWorkoutAt == null) return true;
  return Date.parse(lastWorkoutAt) < now - QUIET_WINDOW_MS;
}

export function CoachClientsPage() {
  const t = useTranslations('coach');
  const locale = useLocale();
  const clients = useCoachClients();
  const archive = useArchiveClient();
  const restore = useRestoreClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [intent, setIntent] = useState<'archive' | 'restore'>('archive');
  const [confirming, setConfirming] = useState<CoachClientSummary | null>(null);
  const [sort, setSort] = useState<ClientSort | null>(null);
  const [workFilters, setWorkFilters] = useState<WorkFilter[]>([]);
  const [now] = useState(() => Date.now());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const inView = useMemo(
    () =>
      (clients.data?.clients ?? []).filter((client) =>
        view === 'archived' ? client.archived : !client.archived,
      ),
    [clients.data, view],
  );
  const listed = useMemo(() => {
    if (view !== 'active' || workFilters.length === 0) return inView;
    return inView.filter((client) =>
      workFilters.every((filter) => matchesWorkFilter(client, filter, now)),
    );
  }, [inView, view, workFilters, now]);
  const visible = useMemo(() => {
    const filtered = filterClients(listed, search);
    if (!sort) return filtered;
    return [...filtered].sort((left, right) => {
      const result = compareClients(left, right, sort.id, locale, {
        unnamed: t('unnamed'),
        missing: t('programMissing'),
      });
      return sort.desc ? -result : result;
    });
  }, [listed, search, sort, locale, t]);
  const pending = inView.find((client) => client.id === pendingId) ?? null;
  const sheetClient = pending ?? confirming;

  const actionPending = archive.isPending || restore.isPending;

  function askArchive(client: CoachClientSummary) {
    if (actionPending) return;
    archive.reset();
    restore.reset();
    setIntent('archive');
    setConfirming(client);
    setPendingId(client.id);
  }

  function askRestore(client: CoachClientSummary) {
    if (actionPending) return;
    archive.reset();
    restore.reset();
    setIntent('restore');
    setConfirming(client);
    setPendingId(client.id);
  }

  function dismissArchive() {
    if (actionPending) return;
    setPendingId(null);
    archive.reset();
    restore.reset();
  }

  async function downloadExport() {
    if (exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const filename = `ys-fitness-clients-${exportDay()}.xlsx`;
      const blob = await exportCoachTable({
        filename,
        sheet: 'Clients',
        headers: [
          t('name'),
          t('email'),
          t('joined'),
          t('program'),
          t('lastWorkout'),
          t('subscription'),
        ],
        rows: visible.map((client) => [
          client.name?.trim() ? client.name : t('unnamed'),
          client.email,
          formatDay(locale, client.createdAt),
          client.programName
            ? programCatalogName({ name: client.programName })
            : t('programMissing'),
          client.lastWorkoutAt
            ? formatDay(locale, client.lastWorkoutAt)
            : t('noWorkout'),
          client.subscriptionActive
            ? t('subscriptionActive')
            : client.subscriptionOnFile
              ? t('subscriptionInactive')
              : t('noSubscription'),
        ]),
      });
      saveBlob(blob, filename);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function toggleSort(column: ClientSort['id']) {
    setSort((current) => {
      if (current?.id !== column) return { id: column, desc: false };
      if (!current.desc) return { id: column, desc: true };
      return null;
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl leading-none text-ink">
          {t('title')}
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg whitespace-nowrap"
          disabled={exporting}
          onClick={() => void downloadExport()}
        >
          {exporting ? t('exporting') : t('exportExcel')}
        </Button>
      </div>
      {exportError ? (
        <p role="alert" className="mt-4 text-sm text-amber">
          {t('exportError')}
        </p>
      ) : null}
      {clients.data ? (
        <p className="mt-2 text-sm text-muted">
          {t('count', { count: listed.length })}
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
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={view === 'active' ? 'primary' : 'outline'}
              className="rounded-lg whitespace-nowrap"
              aria-pressed={view === 'active'}
              onClick={() => {
                setView('active');
                dismissArchive();
              }}
            >
              {t('rosterActive')}
            </Button>
            <Button
              size="sm"
              variant={view === 'archived' ? 'primary' : 'outline'}
              className="rounded-lg whitespace-nowrap"
              aria-pressed={view === 'archived'}
              onClick={() => {
                setView('archived');
                dismissArchive();
              }}
            >
              {t('rosterArchived')}
            </Button>
          </div>
          {view === 'active' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {WORK_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={workFilters.includes(filter) ? 'primary' : 'outline'}
                  className="rounded-lg whitespace-nowrap"
                  aria-pressed={workFilters.includes(filter)}
                  onClick={() =>
                    setWorkFilters((current) =>
                      current.includes(filter)
                        ? current.filter((item) => item !== filter)
                        : [...current, filter],
                    )
                  }
                >
                  {t(
                    filter === 'quiet'
                      ? 'filterQuiet'
                      : filter === 'expired'
                        ? 'filterExpired'
                        : 'filterUnassigned',
                  )}
                </Button>
              ))}
            </div>
          ) : null}
          <input
            type="search"
            value={search}
            aria-label={t('searchClients')}
            placeholder={t('searchClients')}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-4 h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <Sheet
            open={pending !== null}
            dismissible={!actionPending}
            onOpenChange={(next) => {
              if (next) return;
              dismissArchive();
            }}
          >
            <SheetContent>
              <SheetTitle>
                {t(intent === 'restore' ? 'restoreConfirm' : 'archiveConfirm', {
                  name: sheetClient?.name?.trim()
                    ? sheetClient.name
                    : t('unnamed'),
                })}
              </SheetTitle>
              <SheetDescription>
                {t(intent === 'restore' ? 'restoreBody' : 'archiveBody')}
              </SheetDescription>
              {archive.isError || restore.isError ? (
                <p role="alert" className="mb-4 text-center text-sm text-amber">
                  {t(intent === 'restore' ? 'restoreError' : 'archiveError')}
                </p>
              ) : null}
              <SheetFooter>
                <Button
                  disabled={actionPending || !pending}
                  onClick={() => {
                    if (pending && pending.id === confirming?.id) {
                      if (intent === 'restore') restore.mutate(pending.id);
                      else archive.mutate(pending.id);
                    }
                  }}
                >
                  {actionPending
                    ? t(intent === 'restore' ? 'restoring' : 'archiving')
                    : t(intent === 'restore' ? 'restore' : 'archive')}
                </Button>
                <Button
                  variant="outline"
                  disabled={actionPending}
                  onClick={dismissArchive}
                >
                  {t('archiveCancel')}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted sm:hidden">
            {(
              [
                ['name', t('name')],
                ['email', t('email')],
                ['joined', t('joined')],
                ['program', t('program')],
                ['lastWorkout', t('lastWorkout')],
                ['subscription', t('subscription')],
              ] as const
            ).map(([column, label]) => (
              <SortButton
                key={column}
                label={label}
                column={column}
                sort={sort}
                onSort={toggleSort}
              />
            ))}
          </div>
          {inView.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
              {view === 'archived' ? t('archivedEmpty') : t('activeEmpty')}
            </p>
          ) : listed.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
              {t('filterEmpty')}
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
                    <SortHeader
                      label={t('name')}
                      column="name"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label={t('email')}
                      column="email"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label={t('joined')}
                      column="joined"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label={t('program')}
                      column="program"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label={t('lastWorkout')}
                      column="lastWorkout"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label={t('subscription')}
                      column="subscription"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <th className="px-4 py-3 font-medium" scope="col">
                      <span className="sr-only">
                        {t(view === 'archived' ? 'restore' : 'archive')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((client) => (
                    <ClientRow
                      key={client.id}
                      client={client}
                      locale={locale}
                      busy={actionPending}
                      onArchive={
                        client.archived ? null : () => askArchive(client)
                      }
                      onRestore={
                        client.archived ? () => askRestore(client) : null
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
  onRestore,
  busy,
}: {
  client: CoachClientSummary;
  locale: string;
  onArchive: (() => void) | null;
  onRestore: (() => void) | null;
  busy: boolean;
}) {
  const t = useTranslations('coach');
  const joined = formatDay(locale, client.createdAt);

  return (
    <tr className="relative block border-b border-line px-4 py-4 last:border-b-0 motion-safe:transition-colors sm:table-row sm:px-0 sm:py-0 sm:hover:bg-[var(--color-wash)]">
      <th
        className="block pr-28 font-medium text-ink sm:table-cell sm:px-4 sm:py-3 sm:pr-4"
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
      <td className="absolute top-4 right-4 sm:static sm:table-cell sm:px-4 sm:py-3">
        {client.archived && onRestore ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-8 px-2 text-[11px] tracking-normal"
            aria-label={t('restoreNamed', {
              name: client.name?.trim() ? client.name : t('unnamed'),
            })}
            disabled={busy}
            onClick={onRestore}
          >
            {t('restore')}
          </Button>
        ) : onArchive ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-8 px-2 text-[11px] tracking-normal"
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

type ClientSort = {
  id: 'name' | 'email' | 'joined' | 'program' | 'lastWorkout' | 'subscription';
  desc: boolean;
};

function SortHeader(props: {
  label: string;
  column: ClientSort['id'];
  sort: ClientSort | null;
  onSort: (column: ClientSort['id']) => void;
}) {
  const direction =
    props.sort?.id === props.column
      ? props.sort.desc
        ? 'desc'
        : 'asc'
      : false;
  return (
    <th
      className="px-4 py-3 font-medium"
      scope="col"
      aria-sort={
        direction === 'asc'
          ? 'ascending'
          : direction === 'desc'
            ? 'descending'
            : 'none'
      }
    >
      <SortButton {...props} />
    </th>
  );
}

function SortButton({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: ClientSort['id'];
  sort: ClientSort | null;
  onSort: (column: ClientSort['id']) => void;
}) {
  const direction = sort?.id === column ? (sort.desc ? 'desc' : 'asc') : false;
  return (
    <button
      type="button"
      className="inline-flex min-h-8 items-center gap-1 px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onClick={() => onSort(column)}
    >
      {label}
      {direction === 'asc' ? <ArrowUp size={14} aria-hidden /> : null}
      {direction === 'desc' ? <ArrowDown size={14} aria-hidden /> : null}
    </button>
  );
}

function compareClients(
  left: CoachClientSummary,
  right: CoachClientSummary,
  column: ClientSort['id'],
  locale: string,
  labels: { unnamed: string; missing: string },
) {
  if (column === 'joined') return left.createdAt.localeCompare(right.createdAt);
  if (column === 'lastWorkout') {
    return compareMissingLast(left.lastWorkoutAt, right.lastWorkoutAt);
  }
  if (column === 'subscription') {
    return accessRank(left) - accessRank(right);
  }
  const text = (client: CoachClientSummary) => {
    if (column === 'email') return client.email;
    if (column === 'program') {
      return client.programName
        ? programCatalogName({ name: client.programName })
        : labels.missing;
    }
    return client.name?.trim() ? client.name : labels.unnamed;
  };
  return text(left).localeCompare(text(right), locale, { sensitivity: 'base' });
}

function compareMissingLast(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

function accessRank(client: CoachClientSummary) {
  if (client.subscriptionActive) return 2;
  if (client.subscriptionOnFile) return 1;
  return 0;
}

function matchesWorkFilter(
  client: CoachClientSummary,
  filter: WorkFilter,
  now: number,
): boolean {
  if (filter === 'quiet') return missedRecentWorkout(client.lastWorkoutAt, now);
  if (filter === 'expired') return client.accessExpired;
  return !client.programAssigned;
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
