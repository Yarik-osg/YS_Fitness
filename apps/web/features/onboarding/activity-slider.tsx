'use client';

import type { ActivityLevel } from '@repo/shared-types';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export const ACTIVITY_STOPS = [
  'SEDENTARY',
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
] as const satisfies readonly ActivityLevel[];

export function ActivitySlider({
  value,
  onChange,
  labels,
  label,
}: {
  value?: ActivityLevel;
  onChange: (value: ActivityLevel) => void;
  label: string;
  labels: Record<
    (typeof ACTIVITY_STOPS)[number],
    { label: string; description: string }
  >;
}) {
  const index = Math.max(
    0,
    ACTIVITY_STOPS.findIndex((stop) => stop === value),
  );
  const selected = ACTIVITY_STOPS[index] ?? 'MODERATELY_ACTIVE';
  const copy = labels[selected];
  const lastIndex = ACTIVITY_STOPS.length - 1;

  function select(next: number) {
    const stop = ACTIVITY_STOPS[next];
    if (stop) onChange(stop);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative px-1">
        <div className="relative mb-5 h-5">
          {ACTIVITY_STOPS.map((stop, stopIndex) => {
            const percent = (stopIndex / lastIndex) * 100;
            return (
              <button
                key={stop}
                type="button"
                onClick={() => select(stopIndex)}
                style={{ left: `${percent}%` }}
                className={cn(
                  'absolute top-0 font-label text-[10px] font-semibold uppercase leading-none tracking-[0.04em]',
                  stopIndex === 0 && 'translate-x-0 text-left',
                  stopIndex === lastIndex && '-translate-x-full text-right',
                  stopIndex !== 0 &&
                    stopIndex !== lastIndex &&
                    '-translate-x-1/2 text-center',
                  stopIndex === index ? 'text-accent' : 'text-white/40',
                )}
              >
                {labels[stop].label}
              </button>
            );
          })}
        </div>
        <Slider
          min={0}
          max={lastIndex}
          step={1}
          value={[index]}
          aria-label={label}
          onValueChange={([next]) => select(next ?? 0)}
        />
      </div>
      <div className="border border-white/10 bg-white/[0.02] px-4 py-4">
        <p className="font-heading text-lg uppercase tracking-wide text-white">
          {copy.label}
        </p>
        <p className="mt-1 text-sm leading-6 text-white/55">
          {copy.description}
        </p>
      </div>
    </div>
  );
}
