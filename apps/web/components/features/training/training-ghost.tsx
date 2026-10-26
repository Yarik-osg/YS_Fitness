'use client';

import { useLocale, useTranslations } from 'next-intl';
import { weekDays } from '@/lib/calendar';

export function TrainingGhost() {
  const locale = useLocale();
  const t = useTranslations('training');
  const home = useTranslations('dashboard.home');
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const week = weekDays(new Date());

  return (
    <div className="pb-24 text-white">
      <header className="border-b border-white/5 px-5 pt-8 pb-5">
        <h1 className="font-heading text-[28px] leading-none text-white uppercase">
          {t('title')}
        </h1>
      </header>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <section className="border-[1.5px] border-lime/15 bg-lime/4 px-[18px] py-5">
          <h2 className="font-heading text-[22px] leading-tight text-lime">
            {home('programFallback')}
          </h2>
          <div className="mt-3 h-2.5 w-36 bg-white/20" />
        </section>
        <div>
          <p className="font-label text-[7px] font-bold tracking-[0.16em] text-white/30 uppercase">
            {t('calendar.title')}
          </p>
          <div className="mt-2.5 flex gap-1.5">
            {week.map((day) => (
              <div
                key={day.toDateString()}
                className="grid h-14 flex-1 place-items-center border border-white/10 bg-white/[0.02]"
              >
                <span className="font-label text-[8px] text-white/40 uppercase">
                  {weekday.format(day)}
                </span>
                <span className="font-heading text-sm text-white/70">
                  {day.getDate()}
                </span>
              </div>
            ))}
          </div>
        </div>
        {[0, 1, 2].map((day) => (
          <article
            key={day}
            className="border-[1.5px] border-white/[0.07] bg-white/[0.015] px-4 py-3.5"
          >
            <div className="h-2 w-28 bg-white/15" />
          </article>
        ))}
      </div>
    </div>
  );
}
