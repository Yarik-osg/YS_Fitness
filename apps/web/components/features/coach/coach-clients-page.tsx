'use client';

import type { CoachClientSummary } from '@repo/shared-types';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { useCoachClients } from '@/lib/hooks/use-coach-clients';

export function CoachClientsPage() {
  const t = useTranslations('coach');
  const locale = useLocale();
  const clients = useCoachClients();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <h1 className="font-heading text-3xl leading-none text-ink">
        {t('title')}
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
        <div className="mt-8 overflow-hidden rounded-lg border border-line bg-panel">
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
                  {t('onboarding')}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t('program')}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t('subscription')}
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.data.clients.map((client) => (
                <ClientRow key={client.id} client={client} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}

function ClientRow({
  client,
  locale,
}: {
  client: CoachClientSummary;
  locale: string;
}) {
  const t = useTranslations('coach');
  const joined = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(client.createdAt));

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
      <td className="mt-3 block sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
        <Status
          label={t('onboarding')}
          on={client.onboardingCompleted}
          yes={t('onboardingDone')}
          no={t('onboardingMissing')}
        />
      </td>
      <td className="mt-3 block sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
        <Status
          label={t('program')}
          on={client.programAssigned}
          yes={t('programAssigned')}
          no={t('programMissing')}
        />
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
    </tr>
  );
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
