'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function PricingSection() {
  const t = useTranslations('marketing');

  return (
    <section className="border-t border-white/6 px-5 py-14">
      <p className="mb-2 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
        {t('pricing.eyebrow')}
      </p>
      <h2 className="font-heading text-[1.9rem] font-normal uppercase leading-tight tracking-tight">
        {t('pricing.heading')}
      </h2>

      <div className="mt-7 space-y-3">
        <article className="relative overflow-hidden border border-[#c8ff2e]/35 bg-[#c8ff2e]/3">
          <div className="h-0.5 bg-linear-to-r from-[#c8ff2e] to-transparent" />
          <div className="p-5">
            <span className="absolute top-3.5 right-4 bg-[#c8ff2e] px-2.5 py-0.5 font-label text-[8px] font-bold tracking-[0.12em] text-[#0b0b0b]">
              {t('pricing.featuredBadge')}
            </span>
            <p className="mb-2.5 font-label text-[8px] font-bold tracking-[0.2em] text-white/40">
              {t('pricing.threeMonthsLabel')}
            </p>
            <p className="font-heading text-5xl font-normal tracking-tight">
              2490 <span className="text-2xl text-white/50">₴</span>
            </p>
            <div className="mt-1.5 flex gap-4 text-xs">
              <span className="text-white/45">{t('pricing.perMonth')}</span>
              <span className="font-semibold text-[#c8ff2e]">
                {t('pricing.savings')}
              </span>
            </div>
            <Button
              disabled
              aria-disabled
              className="mt-5 w-full bg-[#c8ff2e] text-[#0b0b0b] shadow-none disabled:opacity-100"
            >
              {t('pricing.chooseThreeMonths')}
            </Button>
          </div>
        </article>

        <article className="border border-white/10 bg-white/2 p-5">
          <p className="mb-2.5 font-label text-[8px] font-bold tracking-[0.2em] text-white/35">
            {t('pricing.oneMonthLabel')}
          </p>
          <p className="font-heading text-4xl font-normal tracking-tight">
            990 <span className="text-xl text-white/40">₴</span>
          </p>
          <p className="mt-1.5 text-xs text-white/35">
            {t('pricing.oneMonthAccess')}
          </p>
          <Button
            disabled
            aria-disabled
            variant="outline"
            className="mt-5 w-full"
          >
            {t('pricing.chooseOneMonth')}
          </Button>
        </article>
      </div>
    </section>
  );
}
