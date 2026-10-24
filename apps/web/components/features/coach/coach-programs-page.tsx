'use client';

import type {
  ProgramAccent,
  TrainerProgramTemplateSummary,
} from '@repo/shared-types';
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { useCoachPrograms } from '@/lib/hooks/use-coach-programs';
import { cn } from '@/lib/utils';

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    equals: filterFn_equals,
    includesString: filterFn_includesString,
  },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const columnHelper = createColumnHelper<
  typeof features,
  TrainerProgramTemplateSummary
>();

const emptyTemplates: TrainerProgramTemplateSummary[] = [];

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const ACCENTS = [
  'NONE',
  'UPPER',
  'LOWER',
  'BACK',
  'CHEST',
  'SHOULDERS',
  'ARMS',
  'LEGS',
] as const satisfies readonly ProgramAccent[];
const TRACKS = ['female', 'male'] as const;
const ORIGINS = ['SYSTEM', 'TRAINER'] as const;
const DAY_COUNTS = [2, 3, 4] as const;

const selectClass =
  'h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink';

type CatalogFilters = {
  level: 'all' | (typeof LEVELS)[number];
  focus: 'all' | ProgramAccent;
  track: 'all' | (typeof TRACKS)[number];
  origin: 'all' | (typeof ORIGINS)[number];
  days: 'all' | `${(typeof DAY_COUNTS)[number]}`;
};

const allFilters: CatalogFilters = {
  level: 'all',
  focus: 'all',
  track: 'all',
  origin: 'all',
  days: 'all',
};

export function CoachProgramsPage() {
  const t = useTranslations('coach');
  const programs = useCoachPrograms();
  const [filters, setFilters] = useState<CatalogFilters>(allFilters);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = programs.data?.templates ?? emptyTemplates;
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor((row) => programCatalogName(row), {
          id: 'name',
          header: t('catalog.name'),
          cell: (context) => (
            <Link
              href={`/coach/programs/${context.row.original.id}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              {context.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor(
          (row) =>
            row.origin === 'SYSTEM' ? t('catalog.system') : t('catalog.custom'),
          {
            id: 'origin',
            header: t('catalog.origin'),
            filterFn: (row, _columnId, value) => row.original.origin === value,
          },
        ),
        columnHelper.accessor(
          (row) =>
            row.gender === 'female' ? t('catalog.female') : t('catalog.male'),
          {
            id: 'track',
            header: t('catalog.track'),
            filterFn: (row, _columnId, value) => row.original.gender === value,
          },
        ),
        columnHelper.accessor((row) => t(`catalog.accents.${row.accent}`), {
          id: 'focus',
          header: t('catalog.focus'),
          filterFn: (row, _columnId, value) => row.original.accent === value,
        }),
        columnHelper.accessor((row) => t(`catalog.levels.${row.level}`), {
          id: 'level',
          header: t('catalog.level'),
          filterFn: (row, _columnId, value) => row.original.level === value,
        }),
        columnHelper.accessor('dayCount', {
          id: 'days',
          header: t('catalog.days'),
          sortFn: 'basic',
          filterFn: (row, _columnId, value) =>
            String(row.original.dayCount) === value,
        }),
        columnHelper.accessor('exerciseCount', {
          id: 'exercises',
          header: t('catalog.exercises'),
          sortFn: 'basic',
        }),
      ]),
    [t],
  );
  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      (Object.entries(filters) as [keyof CatalogFilters, string][])
        .filter(([, value]) => value !== 'all')
        .map(([id, value]) => ({ id, value })),
    [filters],
  );
  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    state: { sorting, globalFilter: search, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
  });
  const rows = table.getRowModel().rows;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl leading-none text-ink">
            {t('catalog.title')}
          </h1>
          {programs.data ? (
            <p className="mt-2 text-sm text-muted">
              {t('catalog.count', { count: rows.length })}
            </p>
          ) : null}
        </div>
        <Link
          href="/coach/programs/new"
          className={cn(
            buttonVariants({ size: 'sm' }),
            'w-fit rounded-lg whitespace-nowrap',
          )}
        >
          {t('catalog.new')}
        </Link>
      </div>

      {programs.isPending ? (
        <div aria-busy="true" className="mt-8 flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      {programs.isError ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p role="alert" className="text-sm text-amber">
            {t('catalog.loadError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg whitespace-nowrap"
            onClick={() => void programs.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {programs.data && programs.data.templates.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-panel px-4 py-8 text-sm text-muted">
          {t('catalog.empty')}
        </p>
      ) : null}

      {programs.data && programs.data.templates.length > 0 ? (
        <>
          <div className="mt-6 flex flex-col gap-3">
            <input
              type="search"
              value={search}
              aria-label={t('catalog.searchPrograms')}
              placeholder={t('catalog.searchPrograms')}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FilterSelect
                label={t('catalog.level')}
                value={filters.level}
                onChange={(level) =>
                  setFilters((current) => ({
                    ...current,
                    level: level as CatalogFilters['level'],
                  }))
                }
              >
                <option value="all">{t('catalog.all')}</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`catalog.levels.${level}`)}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label={t('catalog.focus')}
                value={filters.focus}
                onChange={(focus) =>
                  setFilters((current) => ({
                    ...current,
                    focus: focus as CatalogFilters['focus'],
                  }))
                }
              >
                <option value="all">{t('catalog.all')}</option>
                {ACCENTS.map((accent) => (
                  <option key={accent} value={accent}>
                    {t(`catalog.accents.${accent}`)}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label={t('catalog.track')}
                value={filters.track}
                onChange={(track) =>
                  setFilters((current) => ({
                    ...current,
                    track: track as CatalogFilters['track'],
                  }))
                }
              >
                <option value="all">{t('catalog.all')}</option>
                {TRACKS.map((track) => (
                  <option key={track} value={track}>
                    {track === 'female'
                      ? t('catalog.female')
                      : t('catalog.male')}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label={t('catalog.origin')}
                value={filters.origin}
                onChange={(origin) =>
                  setFilters((current) => ({
                    ...current,
                    origin: origin as CatalogFilters['origin'],
                  }))
                }
              >
                <option value="all">{t('catalog.all')}</option>
                {ORIGINS.map((origin) => (
                  <option key={origin} value={origin}>
                    {origin === 'SYSTEM'
                      ? t('catalog.system')
                      : t('catalog.custom')}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label={t('catalog.days')}
                value={filters.days}
                onChange={(days) =>
                  setFilters((current) => ({
                    ...current,
                    days: days as CatalogFilters['days'],
                  }))
                }
              >
                <option value="all">{t('catalog.all')}</option>
                {DAY_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              {t('catalog.filterEmpty')}
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full min-w-[48rem] text-left text-sm tabular-nums">
                <thead className="border-b border-line text-xs text-muted">
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => {
                        const sorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            className="px-4 py-3 font-medium"
                            scope="col"
                            aria-sort={
                              sorted === 'asc'
                                ? 'ascending'
                                : sorted === 'desc'
                                  ? 'descending'
                                  : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="inline-flex items-center gap-1"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {header.isPlaceholder ? null : (
                                <table.FlexRender header={header} />
                              )}
                              {sorted === 'asc' ? (
                                <ArrowUp size={14} aria-hidden />
                              ) : null}
                              {sorted === 'desc' ? (
                                <ArrowDown size={14} aria-hidden />
                              ) : null}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-line last:border-b-0"
                    >
                      {row.getAllCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={
                            cell.column.id === 'name'
                              ? 'px-4 py-3'
                              : 'px-4 py-3 text-muted'
                          }
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      ))}
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

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs text-muted">
      <span className="mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        {children}
      </select>
    </label>
  );
}

const CATALOG_CODE = /^[WM][BMP][234][A-Z]?$/;

function programCatalogName(template: TrainerProgramTemplateSummary) {
  const suffix = ' - copy';
  let base = template.name;
  let copies = '';
  while (base.endsWith(suffix)) {
    base = base.slice(0, -suffix.length);
    copies += suffix;
  }
  const [head, ...rest] = base.split(' — ');
  const tail = rest.join(' — ');
  const code = head?.trim() ?? '';
  const label = CATALOG_CODE.test(code) && tail.includes('·') ? code : base;
  return `${label}${copies}`;
}
