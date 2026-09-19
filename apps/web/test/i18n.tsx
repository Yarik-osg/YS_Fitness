import { en, uk } from '@repo/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

export function I18nTestProvider({
  children,
  locale = 'uk',
}: {
  children: ReactNode;
  locale?: 'uk' | 'en';
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : uk}
    >
      {children}
    </NextIntlClientProvider>
  );
}
