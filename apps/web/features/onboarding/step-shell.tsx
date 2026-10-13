'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { m } from 'motion/react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function StepShell({
  step,
  total,
  eyebrow,
  title,
  description,
  children,
  canContinue,
  onBack,
  onContinue,
  pending = false,
  error,
  continueLabel,
  continueClassName,
  className,
}: {
  step: number;
  total: number;
  eyebrow: string;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
  pending?: boolean;
  error?: string | null;
  continueLabel?: string;
  continueClassName?: string;
  className?: string;
}) {
  const t = useTranslations('onboarding');

  // Direction of the last step change (+1 forward, -1 back), 0 until the
  // first change so the initial render does not animate.
  const [shownStep, setShownStep] = useState(step);
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  if (step !== shownStep) {
    setShownStep(step);
    setDirection(step > shownStep ? 1 : -1);
  }

  return (
    <main
      className={cn(
        'mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-white/5 bg-[#0b0b0b]',
        className,
      )}
    >
      <nav className="border-b border-white/8 px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 font-label text-[10px] font-medium uppercase tracking-[0.1em] text-accent"
          >
            <ArrowLeft size={20} /> {t('back')}
          </button>
          <BrandMark />
          <div className="flex min-w-15 flex-col items-end gap-1">
            <span className="font-label text-[10px] text-white/35">
              {step + 1}/{total}
            </span>
            <LocaleSwitcher />
          </div>
        </div>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-[3px] flex-1 rounded-sm transition-colors duration-300',
                index <= step ? 'bg-accent' : 'bg-white/18',
              )}
            />
          ))}
        </div>
      </nav>

      <m.section
        key={step}
        initial={direction === 0 ? false : { opacity: 0, x: 24 * direction }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="flex flex-1 flex-col px-5 pb-8 pt-7"
      >
        <header className="mb-6">
          <p className="mb-2.5 font-label text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
          <h1 className="font-heading text-[32px] font-normal uppercase leading-9 tracking-[-0.02em] text-white">
            {title}
          </h1>
          <div className="my-2.5 h-px w-15 bg-accent" />
          {description && (
            <p className="max-w-[19rem] text-[12px] leading-[1.6] text-[#d9d9d9]">
              {description}
            </p>
          )}
        </header>

        <div className="flex-1">{children}</div>

        {error && (
          <p
            role="alert"
            className="mt-5 border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
          >
            {error}
          </p>
        )}

        <Button
          className={cn('mt-7 w-full', continueClassName)}
          disabled={!canContinue || pending}
          onClick={onContinue}
        >
          {pending ? t('saving') : (continueLabel ?? t('continue'))}
        </Button>
      </m.section>
    </main>
  );
}
