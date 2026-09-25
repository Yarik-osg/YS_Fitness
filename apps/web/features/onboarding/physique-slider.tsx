'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { cn } from '@/lib/utils';
import type { ProgramTrack } from './program-track';
import {
  PHYSIQUE_STEPS,
  clampPhysiquePosition,
  nearestPhysiqueLayers,
  physiqueAsset,
  physiqueIndex,
  physiqueValue,
  snapPhysiquePosition,
} from './physique';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function BodyPhysiqueSlider({
  track,
  value,
  onChange,
  label,
  valueLabel,
}: {
  track: ProgramTrack;
  value?: string;
  onChange: (value: string) => void;
  label: string;
  valueLabel: (index: number) => string;
}) {
  const sliderId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const committed = physiqueIndex(value);
  const [position, setPosition] = useState(committed ?? 0);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    if (draggingRef.current || committed === null) return;
    setPosition(committed);
  }, [committed]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  function commit(nextPosition: number) {
    const snapped = snapPhysiquePosition(nextPosition);
    setPosition(snapped);
    onChange(physiqueValue(snapped));
  }

  function positionFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return position;
    return clampPhysiquePosition(
      ((clientX - rect.left) / rect.width) * (PHYSIQUE_STEPS - 1),
    );
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    const next = positionFromClientX(event.clientX);
    setPosition(reducedMotion ? snapPhysiquePosition(next) : next);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const next = positionFromClientX(event.clientX);
    setPosition(reducedMotion ? snapPhysiquePosition(next) : next);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commit(positionFromClientX(event.clientX));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = committed ?? snapPhysiquePosition(position);
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      commit(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      commit(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      commit(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      commit(PHYSIQUE_STEPS - 1);
    }
  }

  const layers = nearestPhysiqueLayers(position, reducedMotion);
  const now = snapPhysiquePosition(position);
  const fillPercent = (position / (PHYSIQUE_STEPS - 1)) * 100;
  const animateCrossfade = !reducedMotion && !dragging;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative mx-auto aspect-3/4 w-full max-w-52 text-accent">
        {layers.map((layer) => (
          <div
            key={layer.index}
            data-physique-index={layer.index}
            data-physique-src={physiqueAsset(track, layer.index)}
            aria-hidden
            className={cn(
              'absolute inset-0',
              animateCrossfade && 'transition-opacity duration-150',
            )}
            style={{
              opacity: layer.opacity,
              backgroundColor: 'var(--accent)',
              maskImage: `url("${physiqueAsset(track, layer.index)}")`,
              WebkitMaskImage: `url("${physiqueAsset(track, layer.index)}")`,
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
            }}
          />
        ))}
      </div>

      <div
        ref={trackRef}
        id={sliderId}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={PHYSIQUE_STEPS - 1}
        aria-valuenow={now}
        aria-valuetext={valueLabel(now)}
        className="relative h-8 cursor-pointer touch-none outline-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-accent shadow-[0_0_0_4px_rgb(11_11_11_/_70%)]"
          style={{ left: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
}
