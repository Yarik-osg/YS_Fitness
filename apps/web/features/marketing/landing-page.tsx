'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { SessionHint } from '@/lib/auth/session-cookie';
import { FaqSection } from './faq-section';
import { PricingSection } from './pricing-section';

const WHY_CARD_ACCENTS = ['teal', 'teal', 'lime', 'lime'] as const;

export function LandingPage({
  sessionHint = null,
}: {
  sessionHint?: SessionHint | null;
}) {
  const t = useTranslations('marketing');
  const account =
    sessionHint === 'complete'
      ? { href: '/dashboard' as const, label: t('nav.account') }
      : sessionHint === 'onboarding'
        ? { href: '/onboarding' as const, label: t('nav.continue') }
        : { href: '/login' as const, label: t('nav.login') };
  const whyCards = t.raw('why.cards') as { label: string; desc: string }[];
  const painPoints = t.raw('painPoints') as string[];
  const credentials = t.raw('coach.credentials') as string[];
  const included = t.raw('included.items') as string[];
  const footerLinks = t.raw('footer.links') as string[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md border-x border-white/5 bg-[#0b0b0b]">
      <nav className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <BrandMark />
          <div className="ml-2">
            <p className="font-label text-[8px] font-medium leading-[1.4] tracking-[0.08em] whitespace-nowrap text-white">
              YANA
              <br />
              STAROSOTNIKOVA
            </p>
            <p className="mt-px font-label text-[7px] font-semibold tracking-[0.08em] text-[#00c7c8]">
              ONLINE FITNESS COACH
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={account.href}
            className="font-label text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-accent"
          >
            {account.label}
          </Link>
          <LocaleSwitcher />
          <span aria-hidden className="flex flex-col gap-[5px]">
            <span className="h-px w-5 bg-white" />
            <span className="h-px w-5 bg-white" />
            <span className="h-px w-5 bg-white" />
          </span>
        </div>
      </nav>
      <div className="h-px bg-white/12" />

      <section className="relative min-h-[520px] overflow-hidden">
        <div className="pointer-events-none absolute top-0 -right-5 z-1 h-[480px] w-[72%] max-w-[340px]">
          <Image
            src="/marketing/hero.png"
            alt="Yana Starosotnikova — fitness coach"
            fill
            priority
            sizes="340px"
            className="object-cover object-top [mask-image:linear-gradient(to_left,rgba(0,0,0,0.9)_50%,transparent)]"
          />
        </div>
        <div className="pointer-events-none absolute right-[-40px] bottom-20 z-0 h-[240px] w-[260px] rounded-full bg-[#c8ff2e]/18 blur-[80px]" />
        <div className="relative z-10 max-w-[220px] px-4 pt-6">
          <h1 className="font-heading text-[42px] leading-[40px] font-normal tracking-[-0.04em] text-white uppercase">
            <span className="block">{t('hero.titleLine1')}</span>
            <span className="block">{t('hero.titleLine2')}</span>
            <span className="block">
              {t('hero.titleLine3')}{' '}
              <span className="text-accent">{t('hero.titleAccent1')}</span>
            </span>
            <span className="block text-accent">{t('hero.titleAccent2')}</span>
          </h1>
          <div className="mt-4 mb-3 h-px w-[81px] bg-[#35F3E6]" />
          <p className="max-w-[168px] text-[12px] leading-[1.55] font-medium text-[#d9d9d9]">
            {t('hero.subtitle')}
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-block border-[1.5px] border-accent px-[22px] py-2.5 font-label text-[11px] font-semibold tracking-[0.12em] text-accent uppercase transition hover:bg-accent hover:text-[#0b0b0b]"
          >
            {t('hero.cta')}
          </Link>
          <p className="mt-7 font-label text-[8px] font-medium tracking-[0.1em] text-white">
            TRAIN.&nbsp;&nbsp;DISCIPLINE.&nbsp;&nbsp;
            <span className="text-[#c8ff2e]">EVOLVE</span>
          </p>
        </div>
      </section>

      <section className="border-t border-white/6 py-12">
        <div className="px-5 pb-6">
          <p className="mb-2.5 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t('why.eyebrow')}
          </p>
          <h2 className="font-heading text-[26px] font-normal uppercase leading-[1.1] tracking-[-0.02em]">
            {t('why.heading')}
          </h2>
        </div>
        <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {whyCards.map((card, index) => {
            const accent = WHY_CARD_ACCENTS[index] ?? 'teal';
            return (
              <article
                key={card.label}
                className={`relative min-w-[72%] shrink-0 snap-start overflow-hidden border bg-white/[0.015] px-[18px] pt-5 pb-[22px] md:min-w-[15rem] ${
                  accent === 'lime' ? 'border-[#c8ff2e]/15' : 'border-accent/15'
                }`}
              >
                <div
                  className={`absolute inset-x-0 top-0 h-0.5 bg-linear-to-r to-transparent ${
                    accent === 'lime' ? 'from-[#c8ff2e]' : 'from-accent'
                  }`}
                />
                <WhyCardIcon index={index} />
                <p
                  className={`mb-2 font-label text-[9px] font-bold tracking-[0.16em] ${
                    accent === 'lime' ? 'text-[#c8ff2e]' : 'text-accent'
                  }`}
                >
                  {card.label}
                </p>
                <p className="text-[12px] leading-[1.6] text-white/55">
                  {card.desc}
                </p>
              </article>
            );
          })}
        </div>
        <div className="mt-[18px] flex justify-center gap-1.5">
          {whyCards.map((card, index) => (
            <span
              key={card.label}
              className={`h-1 rounded-sm ${
                index === 0 ? 'w-[18px] bg-accent' : 'w-[5px] bg-white/15'
              }`}
            />
          ))}
        </div>
      </section>

      <section className="space-y-7 border-t border-white/6 px-5 py-[52px]">
        {painPoints.map((text) => (
          <div key={text} className="flex items-start gap-4">
            <span className="mt-1 h-11 w-0.5 shrink-0 bg-linear-to-b from-accent to-accent/25" />
            <p className="font-serif text-[22px] leading-[1.5] text-white/80 italic">
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
          <div className="absolute inset-0 bg-linear-to-b from-transparent from-30% via-[#0b0b0b]/70 via-70% to-[#0b0b0b]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-accent/7 to-transparent" />
          <div className="absolute bottom-7 left-5">
            <h2 className="font-heading text-[32px] font-normal uppercase leading-[1.1] tracking-[-0.01em]">
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

      <section className="border-t border-white/6 px-5 py-[52px]">
        <p className="mb-2.5 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
          {t('included.eyebrow')}
        </p>
        <h2 className="font-heading text-[30px] font-normal uppercase leading-[1.1] tracking-[-0.02em]">
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
              <span className="text-[13px] leading-[1.4] text-white/75">
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
          <h2 className="font-heading text-[30px] font-normal uppercase leading-[1.15] tracking-[-0.02em]">
            {t('finalCta.titleLine1')}
            <br />
            {t('finalCta.titleLine2')}
            <br />
            {t('finalCta.titleLine3')}
          </h2>
          <div className="mx-auto my-5 h-px w-12 bg-accent" />
          <p className="mx-auto mb-8 max-w-[17.5rem] text-[13px] leading-[1.65] text-white/50">
            {t('finalCta.body')}
          </p>
          <Link href="/onboarding">
            <Button className="h-auto min-h-0 px-9 py-4 text-[12px] tracking-[0.16em]">
              {t('finalCta.cta')}
            </Button>
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

function WhyCardIcon({ index }: { index: number }) {
  const stroke = index < 2 ? '#35f5e8' : '#c8ff2e';
  const icons = [
    <svg
      key="athlete"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="7" r="4" />
      <path d="M4 19c0-3.866 3.134-7 7-7h0c3.866 0 7 3.134 7 7" />
      <path d="M8 3.5 11 1l3 2.5" />
    </svg>,
    <svg
      key="approach"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5v12M18 5v12M2 9h3M17 9h3M2 15h3M17 15h3M7 11h8" />
    </svg>,
    <svg
      key="nutrition"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 2C8 2 5.5 4.5 5.5 7.5c0 2 .8 3.8 2.2 5L9 18h4l1.3-5.5c1.4-1.2 2.2-3 2.2-5C16.5 4.5 14 2 11 2z" />
      <path d="M9 18v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1" />
    </svg>,
    <svg
      key="progress"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 19h16M5 19V12M8.5 19V8M12 19V4M15.5 19V10" />
    </svg>,
  ];

  return <div className="mb-4">{icons[index]}</div>;
}
