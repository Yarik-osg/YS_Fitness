import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  Cormorant_Garamond,
  Manrope,
  Montserrat,
  Oswald,
} from 'next/font/google';
import { Providers } from '@/components/providers';
import { routing } from '@/i18n/routing';
import '../globals.css';

const oswald = Oswald({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YS Fitness',
  description: 'Personal training, workouts, and nutrition coaching.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${oswald.variable} ${manrope.variable} ${montserrat.variable} ${cormorant.variable}`}
    >
      <head>
        {/* Remove this script when the ngrok tunnel is gone. ngrok's visit cookie is SameSite=None, and iPad Safari does not send it on stylesheets or scripts, so the free warning page replaces them. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var h=location.hostname;if(!/(\\.ngrok(-free)?\\.(dev|app)|\\.ngrok\\.io)$/.test(h))return;var ipad=navigator.maxTouchPoints>1&&/MacIntel|iPad/.test(navigator.platform+navigator.userAgent);if(!ipad||document.cookie.indexOf('ngrok_asset=1')!==-1)return;document.cookie='abuse_interstitial='+h+';path=/;max-age=604800;SameSite=Lax;Secure';document.cookie='ngrok_asset=1;path=/;max-age=604800;SameSite=Lax;Secure';if(document.cookie.indexOf('ngrok_asset=1')===-1)return;location.reload()})()`,
          }}
        />
      </head>
      <body className="noise-overlay">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
