'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

export function Slider({
  className,
  'aria-label': ariaLabel,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      aria-label={ariaLabel}
      className={cn(
        'relative flex h-8 w-full touch-none items-center select-none',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-px w-full grow bg-white/15">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block size-5 rounded-full border-2 border-background bg-accent shadow-[0_0_0_4px_rgb(11_11_11_/_70%)] outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </SliderPrimitive.Root>
  );
}
