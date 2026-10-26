'use client';

import { useLocale, useMessages, useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/stores/auth-store';

export function HomeGhost() {
  const t = useTranslations('dashboard');
  const messages = useMessages();
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const quotes = messages.dashboard.home.quotes;
  const quote = quotes[new Date().getDay() % quotes.length] ?? quotes[0];

  return (
    <div className="pb-24">
      <header className="border-b border-white/5 px-5 pt-7 pb-5">
        <p className="font-label text-[8px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          {formatHomeDate(locale, new Date())}
        </p>
        <h2 className="mt-1.5 font-heading text-[30px] leading-none text-white uppercase">
          {t('home.screenTitle')}
        </h2>
      </header>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <section className="border-[1.5px] border-teal/12 bg-teal/4 px-[18px] py-[18px]">
          <h2 className="mb-3.5 font-heading text-xl tracking-[0.04em] text-teal">
            {t('home.programFallback')}
          </h2>
          <div className="flex flex-col gap-1.5">
            <Stat label={t('home.nextWorkout')} value="—" />
            <Stat label={t('home.perWeek')} value="—" />
            <Stat label={t('home.sessions')} value="—" />
          </div>
        </section>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative min-h-[130px] border-[1.5px] border-lime/20 px-4 py-[18px]">
            <p className="font-label text-[7px] font-bold tracking-[0.16em] text-lime/70 uppercase">
              {t('home.training')}
            </p>
          </div>
          <div className="relative min-h-[100px] border-[1.5px] border-teal/15 bg-teal/4 px-4 py-4">
            <p className="mb-2 font-label text-[7px] font-bold tracking-[0.16em] text-teal/65 uppercase">
              {t('home.nav.progress')}
            </p>
            <p className="font-heading text-xl leading-none text-white">—</p>
          </div>
          <div className="relative min-h-[100px] border-[1.5px] border-white/10 bg-white/[0.02] px-4 py-4">
            <p className="mb-2 font-label text-[7px] font-bold tracking-[0.16em] text-white/35 uppercase">
              {t('home.profile')}
            </p>
            <p className="font-heading text-[17px] leading-tight text-white">
              {user?.name ?? user?.email}
            </p>
          </div>
        </div>
        <p className="border-l-2 border-white/10 bg-white/[0.01] px-[18px] py-4 font-serif text-[15px] leading-relaxed text-white/40 italic">
          “{quote}”
        </p>
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-medium text-white/40">{label}</p>
      <p className="font-label text-[10px] font-bold tracking-[0.08em] text-white uppercase">
        {value}
      </p>
    </div>
  );
}

export function formatHomeDate(locale: string, date: Date) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}
