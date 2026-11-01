'use client';

import type { CoachNutritionRosterRow } from '@repo/shared-types';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { exportCoachTable } from '@/lib/api/coach';
import { useCoachNutritionRoster } from '@/lib/hooks/use-coach-clients';
import { roundHalfAwayFromZero } from '@/lib/nutrition-display';
import { exportDay, saveBlob } from '@/lib/save-blob';

export function CoachNutritionPage() {
  const t = useTranslations('coach');
  const locale = useLocale();
  const roster = useCoachNutritionRoster();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const inView = useMemo(
    () =>
      (roster.data?.clients ?? []).filter((row) =>
        view === 'archived' ? row.archived : !row.archived,
      ),
    [roster.data, view],
  );
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return inView.filter((row) => {
      if (!query) return true;
      const name = row.name?.trim() ? row.name : t('unnamed');
      return `${name} ${row.email}`.toLocaleLowerCase(locale).includes(query);
    });
  }, [inView, search, locale, t]);

  async function downloadExport() {
    if (exporting) return;
    setExporting(true);
    setExportError(false);
    const blank = t('emptyValue');
    const filename = `ys-fitness-nutrition-${exportDay()}.xlsx`;
    try {
      const blob = await exportCoachTable({
        filename,
        sheet: 'Nutrition',
        headers: [
          t('name'),
          t('email'),
          t('nutritionRoster.kcal'),
          t('nutritionRoster.protein'),
          t('nutritionRoster.fat'),
          t('nutritionRoster.carbs'),
          t('fields.sex'),
          t('nutritionRoster.age'),
          t('nutritionRoster.height'),
          t('nutritionRoster.weight'),
          t('nutritionRoster.activity'),
          t('nutritionRoster.goal'),
        ],
        rows: rows.map((row) => {
          const inputs = row.inputs;
          const target = row.target;
          return [
            row.name?.trim() ? row.name : t('unnamed'),
            row.email,
            target
              ? `${roundHalfAwayFromZero(target.targetCalories)} ${t(
                  target.source === 'MANUAL'
                    ? 'nutritionRoster.manual'
                    : 'nutritionRoster.calculated',
                )}`
              : t('nutritionRoster.noTarget'),
            target ? String(roundHalfAwayFromZero(target.proteinGrams)) : blank,
            target ? String(roundHalfAwayFromZero(target.fatGrams)) : blank,
            target ? String(roundHalfAwayFromZero(target.carbsGrams)) : blank,
            inputs ? t(`sex.${inputs.sex}`) : blank,
            inputs?.ageYears ?? blank,
            inputs ? `${measure(locale, inputs.heightCm)} ${t('cm')}` : blank,
            inputs?.weightKg
              ? `${measure(locale, inputs.weightKg)} ${t('kg')}`
              : blank,
            inputs?.activity
              ? t(`nutritionRoster.activityLevel.${inputs.activity}`)
              : blank,
            inputs ? t(`nutritionRoster.nutritionGoal.${inputs.goal}`) : blank,
          ];
        }),
      });
      saveBlob(blob, filename);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl leading-none text-ink">
          {t('nutritionRoster.title')}
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
      <p className="mt-3 max-w-2xl text-sm text-muted">
        {t('nutritionRoster.hint')}
      </p>

      {roster.isPending ? (
        <div aria-busy="true" className="mt-8 flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      {roster.isError ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p role="alert" className="text-sm text-amber">
            {t('nutritionRoster.loadError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg whitespace-nowrap"
            onClick={() => void roster.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {roster.data && roster.data.clients.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
          {t('nutritionRoster.empty')}
        </p>
      ) : null}

      {roster.data && roster.data.clients.length > 0 ? (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={view === 'active' ? 'primary' : 'outline'}
              className="rounded-lg whitespace-nowrap"
              aria-pressed={view === 'active'}
              onClick={() => setView('active')}
            >
              {t('rosterActive')}
            </Button>
            <Button
              size="sm"
              variant={view === 'archived' ? 'primary' : 'outline'}
              className="rounded-lg whitespace-nowrap"
              aria-pressed={view === 'archived'}
              onClick={() => setView('archived')}
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
          {inView.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
              {view === 'archived' ? t('archivedEmpty') : t('activeEmpty')}
            </p>
          ) : rows.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
              {t('searchEmpty')}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full min-w-[60rem] text-left text-sm tabular-nums">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th
                      className="sticky left-0 bg-panel px-4 py-3 font-medium"
                      scope="col"
                    >
                      {t('name')}
                    </th>
                    <Column label={t('nutritionRoster.kcal')} />
                    <Column label={t('nutritionRoster.protein')} />
                    <Column label={t('nutritionRoster.fat')} />
                    <Column label={t('nutritionRoster.carbs')} />
                    <Column label={t('fields.sex')} />
                    <Column label={t('nutritionRoster.age')} />
                    <Column label={t('nutritionRoster.height')} />
                    <Column label={t('nutritionRoster.weight')} />
                    <Column label={t('nutritionRoster.activity')} />
                    <Column label={t('nutritionRoster.goal')} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <NutritionRow key={row.id} row={row} locale={locale} />
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

function Column({ label }: { label: string }) {
  return (
    <th className="px-4 py-3 font-medium whitespace-nowrap" scope="col">
      {label}
    </th>
  );
}

function NutritionRow({
  row,
  locale,
}: {
  row: CoachNutritionRosterRow;
  locale: string;
}) {
  const t = useTranslations('coach');
  const blank = t('emptyValue');
  const inputs = row.inputs;
  const target = row.target;

  return (
    <tr className="border-b border-line last:border-b-0">
      <th
        className="sticky left-0 bg-panel px-4 py-3 text-left font-medium text-ink"
        scope="row"
      >
        <Link
          href={`/coach/clients/${row.id}`}
          className="underline decoration-line underline-offset-4 hover:text-teal hover:decoration-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {row.name?.trim() ? row.name : t('unnamed')}
        </Link>
        <span className="mt-1 block text-xs font-normal break-all text-muted">
          {row.email}
        </span>
      </th>
      <Cell>
        <span>
          {target
            ? roundHalfAwayFromZero(target.targetCalories)
            : t('nutritionRoster.noTarget')}
        </span>
        {target ? (
          <span className="mt-1 block text-xs font-normal text-muted">
            {t(
              target.source === 'MANUAL'
                ? 'nutritionRoster.manual'
                : 'nutritionRoster.calculated',
            )}
          </span>
        ) : null}
      </Cell>
      <Cell>{target ? roundHalfAwayFromZero(target.proteinGrams) : blank}</Cell>
      <Cell>{target ? roundHalfAwayFromZero(target.fatGrams) : blank}</Cell>
      <Cell>{target ? roundHalfAwayFromZero(target.carbsGrams) : blank}</Cell>
      <Cell>{inputs ? t(`sex.${inputs.sex}`) : blank}</Cell>
      <Cell>{inputs?.ageYears ?? blank}</Cell>
      <Cell>
        {inputs ? `${measure(locale, inputs.heightCm)} ${t('cm')}` : blank}
      </Cell>
      <Cell>
        {inputs?.weightKg
          ? `${measure(locale, inputs.weightKg)} ${t('kg')}`
          : blank}
      </Cell>
      <Cell>
        {inputs?.activity
          ? t(`nutritionRoster.activityLevel.${inputs.activity}`)
          : blank}
      </Cell>
      <Cell>
        {inputs ? t(`nutritionRoster.nutritionGoal.${inputs.goal}`) : blank}
      </Cell>
    </tr>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 whitespace-nowrap text-ink">{children}</td>;
}

function measure(locale: string, value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    amount,
  );
}
