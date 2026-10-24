'use client';

import { useState, type ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { getUserFacingError } from '@/lib/api/errors';
import { useLogout } from '@/lib/hooks/use-auth';
import { useTranslations } from 'next-intl';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function CoachShell({ children }: { children: ReactNode }) {
  const t = useTranslations('coach');
  const auth = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const [error, setError] = useState<string | null>(null);
  const onRoster = pathname === '/coach';

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
    <div className="coach-app min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/coach"
              className={`font-heading text-lg leading-none tracking-wide text-ink uppercase ${focusRing}`}
            >
              YS Fitness
            </Link>
            <Link
              href="/coach"
              aria-current={onRoster ? 'page' : undefined}
              className={`font-label text-xs font-semibold motion-safe:transition-colors ${focusRing} ${
                onRoster
                  ? 'text-ink shadow-[inset_0_-1px_0_0_var(--color-teal)]'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t('roster')}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher
              className={`inline-flex h-10 items-center rounded-lg px-3 text-xs font-semibold tracking-normal text-muted normal-case hover:text-ink motion-safe:transition-colors ${focusRing}`}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-fit rounded-lg whitespace-nowrap"
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
