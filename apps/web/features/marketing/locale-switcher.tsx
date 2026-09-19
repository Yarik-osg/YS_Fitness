'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('marketing');
  const nextLocale = locale === 'uk' ? 'en' : 'uk';

  return (
    <button
      type="button"
      aria-label={t('nav.switchLocale')}
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className="flex items-center gap-1 font-label text-[6px] tracking-[0.1em] text-white"
    >
      <span className="flex flex-col gap-px">
        <span className="h-1 w-2.5 rounded-[1px] bg-[#2346f2]" />
        <span className="h-1 w-2.5 rounded-[1px] bg-[#eaf134]" />
      </span>
      {locale === 'uk' ? t('nav.localeUk') : t('nav.localeEn')}
    </button>
  );
}
