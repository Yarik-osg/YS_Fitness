import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Choice {
  value: string;
  label: string;
  description?: string;
  image?: string;
}

export function ChoiceList({
  choices,
  value,
  onChange,
  grid = false,
  imageGrid = false,
}: {
  choices: Choice[];
  value?: string;
  onChange: (value: string) => void;
  grid?: boolean;
  imageGrid?: boolean;
}) {
  return (
    <div className={cn('grid gap-3', grid && 'grid-cols-2')}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(choice.value)}
            className={cn(
              'relative flex min-h-15 items-center gap-3 overflow-hidden border bg-white/3 p-4 text-left transition',
              selected
                ? 'border-accent bg-accent/7'
                : 'border-white/12 hover:border-white/30',
              grid && 'min-h-23 flex-col items-start justify-center',
              choice.image && 'min-h-44',
              imageGrid && 'aspect-3/4 min-h-0 justify-end p-3',
            )}
            style={
              choice.image
                ? {
                    backgroundImage: `linear-gradient(to top, rgb(9 11 13 / 92%), rgb(9 11 13 / 5%) 70%), url("${choice.image}")`,
                    backgroundPosition: 'center top',
                    backgroundSize: 'cover',
                  }
                : undefined
            }
          >
            {selected && (
              <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-accent text-black">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <span className="font-heading text-base uppercase tracking-wide text-ink">
              {choice.label}
            </span>
            {choice.description && (
              <span className="text-[10px] leading-4 text-muted">
                {choice.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function MultiChoiceList({
  choices,
  value,
  onChange,
}: {
  choices: Choice[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(nextValue: string) {
    if (nextValue === 'none' || nextValue === 'full_body') {
      onChange(value.includes(nextValue) ? [] : [nextValue]);
      return;
    }
    const withoutExclusive = value.filter(
      (item) => item !== 'none' && item !== 'full_body',
    );
    onChange(
      withoutExclusive.includes(nextValue)
        ? withoutExclusive.filter((item) => item !== nextValue)
        : [...withoutExclusive, nextValue],
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {choices.map((choice) => {
        const selected = value.includes(choice.value);
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(choice.value)}
            className={cn(
              'relative min-h-16 border px-4 py-3 text-left font-heading text-sm uppercase tracking-wide transition',
              selected
                ? 'border-accent bg-accent/7 text-ink'
                : 'border-white/12 bg-white/3 text-muted',
              (choice.value === 'none' || choice.value === 'full_body') &&
                'col-span-2',
            )}
          >
            {choice.label}
            {selected && (
              <Check className="absolute right-3 top-3 text-accent" size={15} />
            )}
          </button>
        );
      })}
    </div>
  );
}
