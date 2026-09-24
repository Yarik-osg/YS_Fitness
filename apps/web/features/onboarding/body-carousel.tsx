'use client';

import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { BodyFigure, isLocalSvg } from './body-figure';
import type { Choice } from './choice-list';

export function BodyCarousel({
  choices,
  value,
  onChange,
  label,
}: {
  choices: Choice[];
  value?: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const index = Math.max(
    0,
    choices.findIndex((choice) => choice.value === value),
  );
  const max = Math.max(choices.length - 1, 1);

  function select(next: number) {
    const clamped = Math.min(Math.max(next, 0), choices.length - 1);
    const choice = choices[clamped];
    if (!choice) return;
    onChange(choice.value);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex min-h-[22rem] w-full items-center justify-center bg-black">
        {choices[index]?.image ? (
          isLocalSvg(choices[index].image) ? (
            <BodyFigure
              src={choices[index].image}
              className="h-[28rem] w-full max-w-64"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={choices[index].image}
              alt=""
              className="max-h-[28rem] w-full object-contain object-top"
            />
          )
        ) : null}
      </div>
      <div className="flex items-center gap-2.5">
        {choices.map((choice, dot) => (
          <button
            key={choice.value}
            type="button"
            aria-label={choice.label}
            aria-current={dot === index}
            onClick={() => select(dot)}
            className={cn(
              'size-2 rounded-full transition',
              dot === index ? 'scale-125 bg-accent' : 'bg-white/25',
            )}
          />
        ))}
      </div>
      <Slider
        min={0}
        max={max}
        step={1}
        value={[index]}
        aria-label={label}
        className="w-full max-w-64"
        onValueChange={([next]) => select(next ?? 0)}
      />
    </div>
  );
}
