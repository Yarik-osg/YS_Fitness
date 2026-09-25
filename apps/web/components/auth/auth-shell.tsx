'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';

export function BrandMark() {
  return (
    <span className="relative inline-block size-9 shrink-0 select-none font-serif leading-none text-[#00c7c8]">
      <span className="sr-only">YS</span>
      <span
        aria-hidden
        className="absolute top-[-4px] left-0 text-[32px] not-italic"
      >
        Y
      </span>
      <span
        aria-hidden
        className="absolute top-1.5 left-2 text-[32px] not-italic"
      >
        S
      </span>
    </span>
  );
}

export function AuthShell({
  eyebrow,
  title,
  highlighted,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  highlighted: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const t = useTranslations('auth');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-white/5 bg-[#0b0d0f]/90">
      <nav className="flex h-16 items-center justify-between border-b border-white/8 px-6">
        <Link
          href="/"
          className="font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-accent"
        >
          {t('back')}
        </Link>
        <BrandMark />
        <LocaleSwitcher />
      </nav>

      <section className="flex flex-1 flex-col px-6 pb-10 pt-12">
        <header className="mb-10">
          <p className="mb-3 font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
          <h1 className="font-heading text-4xl font-normal uppercase leading-[1.05] tracking-tight text-ink">
            {title} <span className="text-accent">{highlighted}</span>
          </h1>
          <div className="my-4 h-px w-16 bg-accent" />
          <p className="max-w-sm text-xs leading-6 text-muted">{description}</p>
        </header>

        {children}
        <div className="mt-auto pt-8 text-center text-xs text-muted">
          {footer}
        </div>
      </section>
    </main>
  );
}
