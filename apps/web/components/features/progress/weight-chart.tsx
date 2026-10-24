'use client';

import type { WeightMeasurement } from '@repo/shared-types';
import { areaY, defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { formatWeight, oneLabelPerDay } from '@/lib/weight-chart';

function paddedDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.06;
  return [min - pad, max + pad];
}

function formatDayMonth(value: string) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

export function WeightChart({
  points,
  label,
  unit,
}: {
  points: WeightMeasurement[];
  label: string;
  unit: string;
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
      tooltip: {
        use: tooltip,
        format: (point) => {
          const when = new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }).format(new Date(point.datum.measuredAt));
          return `${when} · ${formatWeight(locale, point.datum.weightKg)} ${unit}`;
        },
      },
    });
  }, [locale, points, unit]);

  return (
    <div
      className="mb-4 h-28 w-full min-w-0"
      style={{
        ['--ts-chart-tooltip-background' as string]: 'var(--color-panel)',
        ['--ts-chart-tooltip-color' as string]: 'var(--color-ink)',
        ['--ts-chart-tooltip-border' as string]: '1px solid var(--color-line)',
        ['--ts-chart-tooltip-font' as string]:
          '500 0.75rem/1.3 var(--font-body)',
      }}
    >
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
