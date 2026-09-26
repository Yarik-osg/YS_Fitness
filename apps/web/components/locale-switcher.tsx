'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { withLocalePrefix } from '@/lib/auth/proxy-auth';

export function LocaleSwitcher() {
  return (
    <Suspense fallback={<LocaleSwitcherLabel />}>
      <LocaleSwitcherControl />
    </Suspense>
  );
}

function LocaleSwitcherLabel({ onClick }: { onClick?: () => void }) {
  const locale = useLocale();
  const t = useTranslations('marketing');

  return (
    <button
      type="button"
      aria-label={t('nav.switchLocale')}
      onClick={onClick}
      className="font-label text-[10px] font-semibold tracking-[0.1em] text-white uppercase"
    >
      {locale === 'uk' ? t('nav.localeUk') : t('nav.localeEn')}
    </button>
  );
}

function LocaleSwitcherControl() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextLocale: AppLocale = locale === 'uk' ? 'en' : 'uk';

  return (
    <LocaleSwitcherLabel
      onClick={() =>
        router.replace(
          {
            pathname,
            query: queryForLocaleSwitch(searchParams, nextLocale),
          },
          { locale: nextLocale },
        )
      }
    />
  );
}

function queryForLocaleSwitch(
  searchParams: URLSearchParams,
  nextLocale: AppLocale,
): Record<string, string> {
  const query = Object.fromEntries(searchParams.entries());
  if (query.next) {
    query.next = withLocalePrefix(query.next, nextLocale);
  }
  return query;
}
