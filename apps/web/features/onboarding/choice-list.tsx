import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BodyFigure, isLocalSvg } from './body-figure';

export interface Choice {
  value: string;
  label: string;
  description?: string;
  image?: string;
  icon?: string;
}

export function ChoiceList({
  choices,
  value,
  onChange,
  grid = false,
  imageGrid = false,
  goal = false,
}: {
  choices: Choice[];
  value?: string;
  onChange: (value: string) => void;
  grid?: boolean;
  imageGrid?: boolean;
  goal?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-2.5',
        grid && 'grid-cols-2',
        !grid && !imageGrid && 'gap-4',
      )}
    >
      {choices.map((choice, index) => {
        const selected = choice.value === value;
        const svgImage = isLocalSvg(choice.image);
        const programCard = Boolean(choice.image && !imageGrid);
        const maleAccent = choice.value === 'male';
        const femaleAccent = choice.value === 'female';
        const cardAccent = maleAccent
          ? '#c8ff2e'
          : femaleAccent
            ? '#00c7c8'
            : 'var(--accent)';
        const lastOddImage =
          imageGrid && index === choices.length - 1 && choices.length % 2 === 1;

        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(choice.value)}
            className={cn(
              'relative flex min-h-15 items-center gap-3 overflow-hidden border bg-white/3 p-4 text-left transition',
              selected && maleAccent
                ? 'border-[#c8ff2e] bg-[#c8ff2e]/7'
                : selected && femaleAccent
                  ? 'border-[#00c7c8] bg-[#00c7c8]/7'
                  : selected
                    ? 'border-accent bg-accent/7'
                    : 'border-white/12 hover:border-white/30',
              grid && 'min-h-23 flex-col items-start justify-center',
              choice.image && 'min-h-44',
              imageGrid && 'aspect-3/4 min-h-0 justify-end p-0',
              programCard && 'h-[200px] min-h-0 items-end p-4',
              lastOddImage && 'col-span-2 mx-auto w-[calc(50%-5px)]',
              goal && 'gap-4 px-[18px] py-4',
            )}
            style={
              choice.image && !svgImage
                ? {
                    backgroundImage: imageGrid
                      ? `linear-gradient(to bottom, rgb(11 11 11 / 18%), transparent 40%), url("${choice.image}")`
                      : `linear-gradient(135deg, rgb(11 11 11 / 80%), rgb(11 11 11 / 25%)), url("${choice.image}")`,
                    backgroundPosition: 'center top',
                    backgroundSize: 'cover',
                  }
                : undefined
            }
          >
            {selected && (imageGrid || programCard) && (
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow: `inset 0 0 0 1.5px ${cardAccent}, inset 0 0 30px color-mix(in srgb, ${cardAccent} 12%, transparent)`,
                }}
              />
            )}
            {selected && goal && (
              <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
            )}
            {selected && !goal && (
              <span
                className={cn(
                  'absolute top-2 right-2 grid size-[18px] place-items-center rounded-full text-[#0b0b0b]',
                  maleAccent
                    ? 'bg-[#c8ff2e]'
                    : femaleAccent
                      ? 'bg-[#00c7c8]'
                      : 'bg-accent',
                  programCard && 'top-3.5 left-3.5 right-auto size-5',
                )}
              >
                <Check size={11} strokeWidth={3} />
              </span>
            )}
            {programCard && choice.description && (
              <span
                className={cn(
                  'absolute top-3.5 right-3.5 px-2 py-1 font-label text-[7px] font-semibold tracking-[0.16em] uppercase',
                  selected
                    ? maleAccent
                      ? 'bg-[#c8ff2e] text-[#0b0b0b]'
                      : femaleAccent
                        ? 'bg-[#00c7c8] text-[#0b0b0b]'
                        : 'bg-accent text-[#0b0b0b]'
                    : 'bg-white/10 text-white',
                )}
              >
                {choice.description}
              </span>
            )}
            {svgImage && choice.image ? (
              <BodyFigure
                src={choice.image}
                color={
                  maleAccent
                    ? '#c8ff2e'
                    : femaleAccent
                      ? '#00c7c8'
                      : 'var(--accent)'
                }
                className={cn(
                  'pointer-events-none',
                  imageGrid
                    ? 'absolute inset-3'
                    : 'absolute inset-x-8 inset-y-6',
                )}
              />
            ) : null}
            {imageGrid ? (
              <span className="sr-only">{choice.label}</span>
            ) : (
              <>
                {goal && choice.icon ? (
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full text-base',
                      selected
                        ? 'bg-accent text-[#0b0b0b]'
                        : 'bg-white/7 text-white/50',
                    )}
                  >
                    {choice.icon}
                  </span>
                ) : null}
                {!programCard && !grid && !goal && choice.description && (
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center border font-heading text-sm',
                      selected
                        ? 'border-accent text-accent'
                        : 'border-white/20 text-white/40',
                    )}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-1">
                  {programCard && (
                    <span
                      className={cn(
                        'mb-2 h-px w-8',
                        maleAccent
                          ? 'bg-[#c8ff2e]'
                          : femaleAccent
                            ? 'bg-[#00c7c8]'
                            : 'bg-accent',
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'font-heading uppercase tracking-wide text-ink',
                      programCard ? 'text-[26px] leading-none' : 'text-base',
                      goal &&
                        'flex-1 text-[17px] leading-[1.2] tracking-[0.02em]',
                    )}
                  >
                    {choice.label}
                  </span>
                  {choice.description && !programCard && (
                    <span className="text-[10px] leading-4 text-muted">
                      {choice.description}
                    </span>
                  )}
                </span>
                {goal ? (
                  selected ? (
                    <span className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[#0b0b0b]">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="ml-auto size-5 shrink-0 rounded-full border-[1.5px] border-white/20" />
                  )
                ) : null}
              </>
            )}
            {selected && imageGrid && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
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
    <div className="grid grid-cols-2 gap-2.5">
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
