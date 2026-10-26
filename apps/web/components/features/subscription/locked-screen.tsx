'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ClientNav } from '@/components/features/shell/client-nav';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export function LockedProgramScreen({
  children,
  nav,
}: {
  children: ReactNode;
  nav: 'home' | 'training';
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-24">
      <BlurredProgram>{children}</BlurredProgram>
      <ClientNav active={nav} />
    </div>
  );
}

// The program API stays closed without a subscription, so this is the screen's shape.
export function BlurredProgram({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none select-none blur-sm"
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-background/25"
      />
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-4 pb-16">
        <div className="pointer-events-auto w-full max-w-[430px]">
          <LockedAccess />
        </div>
      </div>
    </div>
  );
}

function LockedAccess() {
  const t = useTranslations('dashboard');
  const tCheckout = useTranslations('checkout');
  const rows = [
    { label: t('home.nav.training'), href: null },
    { label: t('home.programFallback'), href: null },
    { label: t('home.nav.profile'), href: '/profile' },
    { label: t('home.nav.progress'), href: '/progress' },
  ] as const;

  return (
    <section className="border border-line bg-panel px-5 py-6">
      <h1 className="font-heading text-[30px] leading-none uppercase">
        {t('subscription.lockedTitle')}
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
        {t('subscription.lockedBody')}
      </p>
      <ul className="mt-6 border-t border-white/10">
        {rows.map((row) => (
          <li key={row.label} className="border-b border-white/10">
            {row.href ? (
              <Link
                href={row.href}
                className="flex min-h-12 items-center justify-between gap-4 text-sm text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {row.label}
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="text-muted"
                />
              </Link>
            ) : (
              <div className="flex min-h-12 items-center justify-between gap-4">
                <span className="text-sm text-ink">{row.label}</span>
                <span className="font-label text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                  {t('subscription.closed')}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Link
        href="/checkout"
        className={buttonVariants({ className: 'mt-6 w-full' })}
      >
        {tCheckout('choosePlanCta')}
      </Link>
    </section>
  );
}
