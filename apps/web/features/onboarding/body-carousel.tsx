'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
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
  const [viewportRef, embla] = useEmblaCarousel({
    align: 'center',
    containScroll: 'trimSnaps',
  });

  function select(next: number) {
    const clamped = Math.min(Math.max(next, 0), choices.length - 1);
    const choice = choices[clamped];
    if (!choice || choice.value === value) return;
    onChange(choice.value);
  }

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      const choice = choices[embla.selectedScrollSnap()];
      if (choice && choice.value !== value) onChange(choice.value);
    };
    embla.on('select', onSelect);
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla, choices, onChange, value]);

  useEffect(() => {
    if (!embla || embla.selectedScrollSnap() === index) return;
    embla.scrollTo(index);
  }, [embla, index]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-full overflow-hidden bg-black" ref={viewportRef}>
        <div className="flex">
          {choices.map((choice) => (
            <div
              key={choice.value}
              className="flex min-h-[22rem] min-w-0 flex-[0_0_100%] items-center justify-center"
            >
              {choice.image ? (
                isLocalSvg(choice.image) ? (
                  <BodyFigure
                    src={choice.image}
                    className="h-[28rem] w-full max-w-64"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={choice.image}
                    alt=""
                    className="max-h-[28rem] w-full object-contain object-top"
                  />
                )
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {choices.map((choice, dot) => (
          <button
            key={choice.value}
            type="button"
            aria-label={choice.label}
            aria-current={dot === index ? 'true' : undefined}
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
