'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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
}) {
  const t = useTranslations('onboarding');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-white/5 bg-[#0b0d0f]/95">
      <nav className="border-b border-white/8 px-5 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 font-label text-[10px] font-semibold uppercase tracking-widest text-accent"
          >
            <ArrowLeft size={16} /> {t('back')}
          </button>
          <BrandMark />
          <div className="flex min-w-15 flex-col items-end gap-1">
            <span className="font-label text-[10px] text-muted">
              {step + 1}/{total}
            </span>
            <LocaleSwitcher />
          </div>
        </div>
        <Progress value={((step + 1) / total) * 100} />
      </nav>

      <section className="flex flex-1 flex-col px-5 pb-8 pt-8">
        <header className="mb-7">
          <p className="mb-2 font-label text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
          <h1 className="font-heading text-[1.8rem] font-normal uppercase leading-[1.12] tracking-tight text-ink">
            {title}
          </h1>
          <div className="my-3 h-px w-15 bg-accent" />
          {description && (
            <p className="text-[11px] leading-5 text-muted">{description}</p>
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
          className="mt-7 w-full"
          disabled={!canContinue || pending}
          onClick={onContinue}
        >
          {pending ? t('saving') : t('continue')}
        </Button>
      </section>
    </main>
  );
}
