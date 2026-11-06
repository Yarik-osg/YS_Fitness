'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { shapeBand } from './body-shape';

const BodyMesh = dynamic(
  () => import('./body-mesh').then((mod) => mod.BodyMesh),
  {
    ssr: false,
  },
);

export function BodyShapeStep({
  sex,
  muscle,
  fat,
  onChange,
}: {
  sex: 'male' | 'female';
  muscle: number;
  fat: number;
  onChange: (muscle: number, fat: number) => void;
}) {
  const t = useTranslations('onboarding');
  const [view, setView] = useState<'front' | 'back'>('front');
  const muscleBand = shapeBand(muscle);
  const fatBand = shapeBand(fat);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[72vh] min-h-[480px] flex-col rounded-2xl border border-white/10 bg-white/[0.03] px-3 pt-2">
        <div className="mb-1 flex shrink-0 justify-center gap-2">
          {(['front', 'back'] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={view === side}
              onClick={() => setView(side)}
              className={cn(
                'rounded-full px-3 py-1 font-label text-[10px] font-semibold uppercase tracking-[0.08em]',
                view === side ? 'bg-accent text-background' : 'text-white/45',
              )}
            >
              {t(`shape.view.${side}`)}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1" data-sex={sex} data-view={view}>
          <BodyMesh muscle={muscle} fat={fat} sex={sex} view={view} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-3">
        <ShapeSlider
          label={t('shape.muscle.label')}
          description={t('shape.muscle.description')}
          band={t(`shape.band.${muscleBand}`)}
          low={t('shape.muscle.low')}
          high={t('shape.muscle.high')}
          value={muscle}
          onChange={(next) => onChange(next, fat)}
        />
        <ShapeSlider
          label={t('shape.fat.label')}
          description={t('shape.fat.description')}
          band={t(`shape.band.${fatBand}`)}
          low={t('shape.fat.low')}
          high={t('shape.fat.high')}
          value={fat}
          onChange={(next) => onChange(muscle, next)}
        />
      </div>
    </div>
  );
}

function ShapeSlider({
  label,
  description,
  band,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  description: string;
  band: string;
  low: string;
  high: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-sm uppercase tracking-wide text-ink">
          {label}
        </p>
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
          {band}
        </p>
      </div>
      <p className="text-sm text-white/45">{description}</p>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value]}
        aria-label={label}
        onValueChange={([next]) => onChange(next ?? 0)}
      />
      <div className="flex justify-between font-label text-[10px] uppercase tracking-[0.06em] text-white/35">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
