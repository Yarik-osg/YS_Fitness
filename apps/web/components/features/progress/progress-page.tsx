'use client';

import type { WeightMeasurement } from '@repo/shared-types';
import { areaY, defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { createMeasurementSchema, WEIGHT_KG } from '@repo/validation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { NumberField } from '@/components/features/profile/number-field';
import { ClientNav } from '@/components/features/shell/client-nav';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserFacingError } from '@/lib/api/errors';
import {
  formatDelta,
  formatWeight,
  latestMeasurement,
  oneLabelPerDay,
} from '@/lib/weight-chart';
import { inPeriod, type WeightPeriod } from '@/lib/weight-period';
import { useCreateMeasurement, useMeasurements } from '@/lib/hooks/use-users';
import { useAssignedProgram } from '@/lib/hooks/use-programs';

const PERIODS: WeightPeriod[] = ['30d', '3m', 'all'];

export function ProgressPage() {
  const t = useTranslations('progress');
  const measurements = useMeasurements();
  const assigned = useAssignedProgram();
  const [now] = useState(() => new Date());
  const [period, setPeriod] = useState<WeightPeriod>('30d');

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-24 text-ink">
      <header className="border-b border-line px-5 pt-8 pb-4">
        <p className="mb-1.5 font-label text-[8px] font-semibold tracking-[0.2em] text-teal uppercase">
          {t('brand')}
        </p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-heading text-[28px] leading-none text-ink uppercase">
            {t('title')}
          </h1>
          <PeriodSwitch period={period} onChange={setPeriod} />
        </div>
      </header>
      <div className="flex flex-col gap-5 px-4 pt-5">
        <WeightCard
          now={now}
          period={period}
          loading={measurements.isPending && !measurements.data}
          error={measurements.isError}
          measurements={measurements.data?.measurements ?? []}
          firstMeasurement={measurements.data?.firstMeasurement ?? null}
        />
        <TrainingCard
          loading={assigned.isPending && assigned.data === undefined}
          error={assigned.isError}
          completed={assigned.data?.programProgress.completed}
          expected={assigned.data?.programProgress.expected}
        />
      </div>
      <ClientNav active="progress" />
    </div>
  );
}

function PeriodSwitch({
  period,
  onChange,
}: {
  period: WeightPeriod;
  onChange: (period: WeightPeriod) => void;
}) {
  const t = useTranslations('progress');

  return (
    <div className="flex gap-0.5 border border-line bg-panel p-0.5">
      {PERIODS.map((item) => {
        const selected = period === item;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item)}
            className={`px-2.5 py-1 font-label text-[7px] font-bold tracking-[0.1em] whitespace-nowrap uppercase ${
              selected ? 'bg-teal text-background' : 'text-muted'
            }`}
          >
            {t(`period.${item}`)}
          </button>
        );
      })}
    </div>
  );
}

function WeightCard({
  now,
  period,
  loading,
  error,
  measurements,
  firstMeasurement,
}: {
  now: Date;
  period: WeightPeriod;
  loading: boolean;
  error: boolean;
  measurements: WeightMeasurement[];
  firstMeasurement: WeightMeasurement | null;
}) {
  const t = useTranslations('progress');
  const locale = useLocale();
  const current = latestMeasurement(measurements);
  const visible = useMemo(
    () =>
      measurements.filter((point) => inPeriod(point.measuredAt, now, period)),
    [measurements, now, period],
  );
  const delta =
    current && firstMeasurement && current.id !== firstMeasurement.id
      ? current.weightKg - firstMeasurement.weightKg
      : null;

  return (
    <section>
      <h2 className="mb-2 text-sm text-muted">{t('weight')}</h2>
      <div className="overflow-hidden border border-line bg-panel">
        <div className="h-px bg-linear-to-r from-teal to-transparent" />
        <div className="px-4 py-4">
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : error ? (
            <p role="alert" className="text-sm text-amber">
              {t('loadError')}
            </p>
          ) : (
            <>
              <div className="mb-1 flex items-end justify-between gap-3">
                <div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="font-heading text-5xl leading-none tracking-tight text-ink tabular-nums">
                      {current ? formatWeight(locale, current.weightKg) : '—'}
                    </span>
                    {current ? (
                      <span className="pb-1 font-label text-[10px] font-bold tracking-[0.12em] text-muted uppercase">
                        {t('kg')}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-teal">
                    {delta === null
                      ? '—'
                      : t('sinceStart', { delta: formatDelta(locale, delta) })}
                  </p>
                </div>
                <div className="pb-1 text-right">
                  <p className="mb-0.5 text-[10px] text-muted">{t('start')}</p>
                  <p className="font-heading text-lg text-muted tabular-nums">
                    {firstMeasurement
                      ? `${formatWeight(locale, firstMeasurement.weightKg)} ${t('kg')}`
                      : '—'}
                  </p>
                </div>
              </div>
              {measurements.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{t('empty')}</p>
              ) : visible.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{t('chartEmpty')}</p>
              ) : (
                <WeightChart points={visible} label={t('chartLabel')} />
              )}
              <AddWeightForm defaultWeightKg={current?.weightKg} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function paddedDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.06;
  return [min - pad, max + pad];
}

function WeightChart({
  points,
  label,
}: {
  points: WeightMeasurement[];
  label: string;
}) {
  const locale = useLocale();
  const definition = useMemo(() => {
    const times = points.map((point) => Date.parse(point.measuredAt));
    return defineChart({
      marks: [
        areaY(points, {
          x: (point) => Date.parse(point.measuredAt),
          y: 'weightKg',
          fill: 'var(--color-teal)',
          fillOpacity: 0.14,
          stroke: 'transparent',
        }),
        lineY(points, {
          x: (point) => Date.parse(point.measuredAt),
          y: 'weightKg',
          points: true,
          stroke: 'var(--color-teal)',
          strokeWidth: 1.5,
        }),
      ],
      margin: { top: 12, right: 8, bottom: 4, left: 28 },
      clip: true,
      scales: {
        x: {
          scale: scaleLinear(paddedDomain(times), [0, 1]),
          grid: false,
          axis: {
            line: false,
            ticks: {
              values: oneLabelPerDay(times),
              line: false,
              format: (value) => formatDayMonth(new Date(value).toISOString()),
            },
            tickLabels: {
              fontSize: 7,
              thin: { minGap: 36, priority: 'ends' },
            },
          },
        },
        y: {
          scale: scaleLinear(
            paddedDomain(points.map((point) => point.weightKg)),
            [0, 1],
          ),
          grid: { stroke: 'var(--color-line)' },
          axis: {
            line: false,
            ticks: {
              count: 3,
              line: false,
              format: (value) => formatWeight(locale, value),
            },
            tickLabels: { fontSize: 7 },
          },
        },
      },
      theme: {
        foreground: 'var(--color-muted)',
        muted: 'var(--color-muted)',
        grid: 'var(--color-line)',
        background: 'transparent',
        palette: ['var(--color-teal)'],
      },
    });
  }, [locale, points]);

  return (
    <div className="mb-4 h-28 w-full min-w-0">
      <Chart
        definition={definition}
        ariaLabel={label}
        className="h-full w-full max-w-full"
        height={112}
        initialWidth={280}
      />
    </div>
  );
}

function AddWeightForm({ defaultWeightKg }: { defaultWeightKg?: number }) {
  const t = useTranslations('progress');
  const tAuth = useTranslations('auth');
  const create = useCreateMeasurement();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setWeight(defaultWeightKg === undefined ? '' : String(defaultWeightKg));
    setError(null);
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
    setError(null);
  }

  function save() {
    const parsed = createMeasurementSchema.safeParse({
      weightKg: Number(weight),
    });
    if (!parsed.success) {
      setError(t('invalid'));
      return;
    }
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: () => {
        setError(null);
        setOpen(false);
      },
      onError: (cause) => {
        setError(getUserFacingError(cause, tAuth));
      },
    });
  }

  if (!open) {
    return (
      <div className="mt-3 flex justify-end border-t border-line pt-3">
        <button
          type="button"
          onClick={openForm}
          className="inline-flex items-center gap-1.5 font-label text-[9px] font-bold tracking-[0.14em] text-teal uppercase"
        >
          <span aria-hidden="true">+</span>
          {t('add')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
      <NumberField
        id="progress-weight"
        label={t('weight')}
        unit={t('kg')}
        value={weight}
        min={WEIGHT_KG.min}
        max={WEIGHT_KG.max}
        onChange={setWeight}
      />
      {error ? (
        <p role="alert" className="text-xs text-amber">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          className="min-h-10 flex-1"
          disabled={create.isPending}
          onClick={save}
        >
          {create.isPending ? t('saving') : t('save')}
        </Button>
        <Button
          variant="outline"
          className="min-h-10 flex-1"
          disabled={create.isPending}
          onClick={cancel}
        >
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}

function TrainingCard({
  loading,
  error,
  completed,
  expected,
}: {
  loading: boolean;
  error: boolean;
  completed?: number;
  expected?: number;
}) {
  const t = useTranslations('progress');
  if (loading || (!error && completed === undefined)) return null;

  const percent =
    expected === undefined || expected === 0
      ? null
      : Math.min(100, Math.round((completed! / expected) * 100));

  return (
    <section>
      <h2 className="mb-2 text-sm text-muted">{t('training')}</h2>
      <div className="border border-line bg-panel px-3 py-3">
        {error ? (
          <p role="alert" className="text-sm text-amber">
            {t('trainingError')}
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <p className="flex items-baseline gap-1 tabular-nums">
                <span className="font-heading text-5xl leading-none text-lime">
                  {completed ?? 0}
                </span>
                <span className="font-heading text-3xl text-muted">/</span>
                <span className="font-heading text-3xl text-ink">
                  {expected ?? 0}
                </span>
              </p>
              {percent === null ? null : (
                <p className="font-heading text-3xl text-lime tabular-nums">
                  {percent}%
                </p>
              )}
            </div>
            <p className="mb-3 text-[11px] text-muted">
              {t('completed', {
                completed: completed ?? 0,
                expected: expected ?? 0,
              })}
            </p>
            {percent === null ? null : (
              <Progress value={percent} label={t('training')} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function formatDayMonth(value: string) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}
