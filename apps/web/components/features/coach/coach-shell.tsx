'use client';

import { useState, type ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { getUserFacingError } from '@/lib/api/errors';
import { useLogout } from '@/lib/hooks/use-auth';
import { useTranslations } from 'next-intl';

export function CoachShell({ children }: { children: ReactNode }) {
  const t = useTranslations('coach');
  const auth = useTranslations('auth');
  const router = useRouter();
  const logout = useLogout();
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setError(null);
    try {
      await logout.mutateAsync();
      router.replace('/login');
    } catch (caught) {
      setError(getUserFacingError(caught, auth));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-baseline gap-4">
            <Link
              href="/coach"
              className="font-heading text-2xl leading-none text-ink uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              YS Fitness
            </Link>
            <Link
              href="/coach"
              className="font-label text-xs font-semibold tracking-[0.12em] text-muted uppercase hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('roster')}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Button
              variant="outline"
              size="sm"
              className="w-fit whitespace-nowrap"
              onClick={() => void signOut()}
              disabled={logout.isPending}
            >
              {logout.isPending ? t('loggingOut') : t('logout')}
            </Button>
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            className="mx-auto w-full max-w-5xl px-4 pb-4 text-sm text-amber sm:px-6"
          >
            {error}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
