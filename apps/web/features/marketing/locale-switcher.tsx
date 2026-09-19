'use client';

import UA from 'country-flag-icons/react/3x2/UA';
import US from 'country-flag-icons/react/3x2/US';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('marketing');
  const nextLocale = locale === 'uk' ? 'en' : 'uk';
  const Flag = locale === 'en' ? US : UA;

  return (
    <button
      type="button"
      aria-label={t('nav.switchLocale')}
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className="flex items-center gap-1 font-label text-[6px] tracking-[0.1em] text-white"
    >
      <Flag aria-hidden className="h-2.5 w-[15px] rounded-[1px]" />
      {locale === 'uk' ? t('nav.localeUk') : t('nav.localeEn')}
    </button>
  );
}
