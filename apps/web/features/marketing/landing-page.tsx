'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { FaqSection } from './faq-section';
import { PricingSection } from './pricing-section';

const WHY_CARD_ACCENTS = ['teal', 'teal', 'lime', 'lime'] as const;

export function LandingPage() {
  const t = useTranslations('marketing');
  const whyCards = t.raw('why.cards') as { label: string; desc: string }[];
  const painPoints = t.raw('painPoints') as string[];
  const credentials = t.raw('coach.credentials') as string[];
  const included = t.raw('included.items') as string[];
  const footerLinks = t.raw('footer.links') as string[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md border-x border-white/5 bg-[#0b0d0f]/95 md:max-w-3xl">
      <nav className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-label text-[8px] font-medium tracking-[0.08em] text-ink">
              YANA
              <br />
              STAROSOTNIKOVA
            </p>
            <p className="mt-0.5 font-label text-[7px] font-semibold tracking-[0.08em] text-accent">
              ONLINE FITNESS COACH
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="font-label text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-accent"
          >
            {t('nav.login')}
          </Link>
          <LocaleSwitcher />
          <span aria-hidden className="flex flex-col gap-1">
            <span className="h-px w-5 bg-white" />
            <span className="h-px w-5 bg-white" />
            <span className="h-px w-5 bg-white" />
          </span>
        </div>
      </nav>

      <section className="relative min-h-[32rem] overflow-hidden px-5 pt-6 pb-8">
        <div className="pointer-events-none absolute top-0 -right-5 z-0 h-[30rem] w-[72%] max-w-[21rem]">
          <Image
            src="/marketing/hero.png"
            alt="Yana Starosotnikova — fitness coach"
            fill
            priority
            className="object-cover object-top [mask-image:linear-gradient(to_left,rgba(0,0,0,0.9)_50%,transparent)]"
          />
        </div>
        <div className="pointer-events-none absolute right-[-2.5rem] bottom-20 z-0 size-[16rem] rounded-full bg-[#c8ff2e]/18 blur-3xl" />
        <div className="relative z-10 max-w-[14rem]">
          <h1 className="font-heading text-[2.6rem] font-normal leading-[0.95] tracking-tight uppercase">
            {t('hero.titleLine1')}
            <br />
            {t('hero.titleLine2')}
            <br />
            {t('hero.titleLine3')}{' '}
            <span className="text-accent">{t('hero.titleAccent1')}</span>
            <br />
            <span className="text-accent">{t('hero.titleAccent2')}</span>
          </h1>
          <div className="my-4 h-px w-20 bg-accent" />
          <p className="max-w-[10.5rem] text-xs leading-5 text-[#d9d9d9]">
            {t('hero.subtitle')}
          </p>
          <Link href="/register" className="mt-6 inline-block">
            <Button variant="outline" className="border-accent text-accent">
              {t('hero.cta')}
            </Button>
          </Link>
          <p className="mt-7 font-label text-[8px] tracking-[0.1em] text-white">
            TRAIN.&nbsp;&nbsp;DISCIPLINE.&nbsp;&nbsp;
            <span className="text-[#c8ff2e]">EVOLVE</span>
          </p>
        </div>
      </section>

      <section className="border-t border-white/6 py-12">
        <div className="px-5 pb-6">
          <p className="mb-2 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t('why.eyebrow')}
          </p>
          <h2 className="font-heading text-[1.6rem] font-normal uppercase leading-tight tracking-tight">
            {t('why.heading')}
          </h2>
        </div>
        <div className="flex gap-2.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {whyCards.map((card, index) => {
            const accent = WHY_CARD_ACCENTS[index] ?? 'teal';
            return (
              <article
                key={card.label}
                className={`relative min-w-[72%] shrink-0 border bg-white/2 px-[18px] py-5 md:min-w-[15rem] ${
                  accent === 'lime' ? 'border-[#c8ff2e]/15' : 'border-accent/15'
                }`}
              >
                <div
                  className={`absolute inset-x-0 top-0 h-0.5 bg-linear-to-r to-transparent ${
                    accent === 'lime' ? 'from-[#c8ff2e]' : 'from-accent'
                  }`}
                />
                <p
                  className={`mb-2 font-label text-[9px] font-bold tracking-[0.16em] ${
                    accent === 'lime' ? 'text-[#c8ff2e]' : 'text-accent'
                  }`}
                >
                  {card.label}
                </p>
                <p className="text-xs leading-5 text-white/55">{card.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-7 border-t border-white/6 px-5 py-[52px]">
        {painPoints.map((text) => (
          <div key={text} className="flex items-start gap-4">
            <span className="mt-1 h-11 w-0.5 shrink-0 bg-linear-to-b from-accent to-accent/25" />
            <p className="font-serif text-[1.35rem] leading-7 text-white/80 italic">
              {text}
            </p>
          </div>
        ))}
      </section>

      <section className="border-t border-white/6">
        <div className="px-5 pt-[52px] pb-5">
          <p className="font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t('coach.eyebrow')}
          </p>
        </div>
        <div className="relative aspect-3/4 max-h-[31rem] w-full overflow-hidden">
          <Image
            src="/marketing/coach.jpg"
            alt={t('coach.imageAlt')}
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#0b0b0b]/70 to-[#0b0b0b]" />
          <div className="absolute bottom-7 left-5">
            <h2 className="font-heading text-[2rem] font-normal uppercase leading-tight">
              {t('coach.nameLine1')}
              <br />
              {t('coach.nameLine2')}
            </h2>
            <div className="mt-2 h-0.5 w-12 bg-accent" />
          </div>
        </div>
        <div className="px-5 pt-5 pb-[52px]">
          <div className="mb-6 flex flex-wrap gap-1.5">
            {credentials.map((cred) => (
              <span
                key={cred}
                className="border border-accent/25 bg-accent/4 px-3 py-1 font-label text-[8px] font-semibold tracking-[0.1em] text-white/60 uppercase"
              >
                {cred}
              </span>
            ))}
          </div>
          <div className="space-y-3.5 border-l-2 border-accent/25 pl-4 text-[13px] leading-7">
            <p className="text-white/75">{t('coach.bio1')}</p>
            <p className="text-white/60">{t('coach.bio2')}</p>
            <p className="text-white/60">{t('coach.bio3')}</p>
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="border-t border-white/6 px-5 py-14">
        <p className="mb-2 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
          {t('included.eyebrow')}
        </p>
        <h2 className="font-heading text-[1.9rem] font-normal uppercase leading-tight tracking-tight">
          {t('included.heading')}
        </h2>
        <ul className="mt-7">
          {included.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3.5 border-b border-white/5 py-3.5 last:border-b-0"
            >
              <span className="grid size-[22px] shrink-0 place-items-center border border-accent/35 bg-accent/10">
                <Check size={10} className="text-accent" strokeWidth={3} />
              </span>
              <span className="text-[13px] leading-5 text-white/75">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <FaqSection />

      <section className="relative overflow-hidden border-t border-white/6 bg-accent/3 px-5 py-16 text-center">
        <div className="pointer-events-none absolute top-1/2 left-1/2 size-[19rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <p className="mb-4 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t('finalCta.eyebrow')}
          </p>
          <h2 className="font-heading text-[1.9rem] font-normal uppercase leading-tight tracking-tight">
            {t('finalCta.titleLine1')}
            <br />
            {t('finalCta.titleLine2')}
            <br />
            {t('finalCta.titleLine3')}
          </h2>
          <div className="mx-auto my-5 h-px w-12 bg-accent" />
          <p className="mx-auto mb-8 max-w-[17.5rem] text-[13px] leading-6 text-white/50">
            {t('finalCta.body')}
          </p>
          <Link href="/register">
            <Button>{t('finalCta.cta')}</Button>
          </Link>
          <p className="mt-4 text-[10px] tracking-wide text-white/20">
            {t('finalCta.note')}
          </p>
        </div>
      </section>

      <footer className="border-t border-white/6 bg-[#080808] px-5 pt-9 pb-10">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandMark />
          <div>
            <p className="font-label text-[9px] font-semibold tracking-[0.1em] text-white/80">
              YS FITNESS
            </p>
            <p className="mt-px text-[10px] text-white/30">
              Yana Starosotnikova
            </p>
          </div>
        </div>
        <div className="h-px bg-white/6" />
        <div className="mt-5 mb-6 flex flex-wrap gap-5">
          {footerLinks.map((label) => (
            <span
              key={label}
              className="font-label text-[9px] font-medium tracking-[0.1em] text-white/30 uppercase"
            >
              {label}
            </span>
          ))}
        </div>
        <p className="text-[10px] leading-5 text-white/18">
          {t('footer.copyright')}
        </p>
      </footer>
    </main>
  );
}
