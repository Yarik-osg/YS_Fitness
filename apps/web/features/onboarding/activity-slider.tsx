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

  function select(next: number) {
    const stop = ACTIVITY_STOPS[next];
    if (stop) onChange(stop);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative px-1">
        <div className="mb-4 grid grid-cols-4">
          {ACTIVITY_STOPS.map((stop, stopIndex) => (
            <button
              key={stop}
              type="button"
              onClick={() => select(stopIndex)}
              className={cn(
                'font-label text-[8px] font-semibold uppercase leading-tight tracking-[0.06em]',
                stopIndex === 0 && 'text-left',
                stopIndex === ACTIVITY_STOPS.length - 1 && 'text-right',
                stopIndex !== 0 &&
                  stopIndex !== ACTIVITY_STOPS.length - 1 &&
                  'text-center',
                stopIndex === index ? 'text-accent' : 'text-white/40',
              )}
            >
              {labels[stop].label}
            </button>
          ))}
        </div>
        <Slider
          min={0}
          max={ACTIVITY_STOPS.length - 1}
          step={1}
          value={[index]}
          aria-label={label}
          onValueChange={([next]) => select(next ?? 0)}
        />
      </div>
      <div className="border border-white/10 bg-white/[0.02] py-4 pr-4 pl-4">
        <div className="border-l-2 border-accent pl-4">
          <p className="font-heading text-lg uppercase tracking-wide text-white">
            {copy.label}
          </p>
          <p className="mt-1 text-sm leading-6 text-white/55">
            {copy.description}
          </p>
        </div>
      </div>
    </div>
  );
}
