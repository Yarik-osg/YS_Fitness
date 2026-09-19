'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { BrandMark } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { FaqSection } from './faq-section';
import {
  CREDENTIALS,
  FOOTER_LINKS,
  INCLUDED,
  PAIN_POINTS,
  WHY_CARDS,
} from './landing-content';
import { PricingSection } from './pricing-section';

export function LandingPage() {
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
            Увійти
          </Link>
          <span
            aria-hidden
            className="flex items-center gap-1 font-label text-[6px] tracking-[0.1em] text-white"
          >
            <span className="flex flex-col gap-px">
              <span className="h-1 w-2.5 rounded-[1px] bg-[#2346f2]" />
              <span className="h-1 w-2.5 rounded-[1px] bg-[#eaf134]" />
            </span>
            УКР
          </span>
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
            Система,
            <br />
            що працює
            <br />
            на <span className="text-accent">твій</span>
            <br />
            <span className="text-accent">результат</span>
          </h1>
          <div className="my-4 h-px w-20 bg-accent" />
          <p className="max-w-[10.5rem] text-xs leading-5 text-[#d9d9d9]">
            Персональний онлайн супровід, тренування та харчування для реальних
            змін
          </p>
          <Link href="/register" className="mt-6 inline-block">
            <Button variant="outline" className="border-accent text-accent">
              Почати зміни
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
            YS Fitness
          </p>
          <h2 className="font-heading text-[1.6rem] font-normal uppercase leading-tight tracking-tight">
            Чому обирають мене
          </h2>
        </div>
        <div className="flex gap-2.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {WHY_CARDS.map((card) => (
            <article
              key={card.label}
              className={`relative min-w-[72%] shrink-0 border bg-white/2 px-[18px] py-5 md:min-w-[15rem] ${
                card.accent === 'lime'
                  ? 'border-[#c8ff2e]/15'
                  : 'border-accent/15'
              }`}
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 bg-linear-to-r to-transparent ${
                  card.accent === 'lime' ? 'from-[#c8ff2e]' : 'from-accent'
                }`}
              />
              <p
                className={`mb-2 font-label text-[9px] font-bold tracking-[0.16em] ${
                  card.accent === 'lime' ? 'text-[#c8ff2e]' : 'text-accent'
                }`}
              >
                {card.label}
              </p>
              <p className="text-xs leading-5 text-white/55">{card.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-7 border-t border-white/6 px-5 py-[52px]">
        {PAIN_POINTS.map((text) => (
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
            Твій тренер
          </p>
        </div>
        <div className="relative aspect-3/4 max-h-[31rem] w-full overflow-hidden">
          <Image
            src="/marketing/coach.jpg"
            alt="Яна Старосотнікова"
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#0b0b0b]/70 to-[#0b0b0b]" />
          <div className="absolute bottom-7 left-5">
            <h2 className="font-heading text-[2rem] font-normal uppercase leading-tight">
              Яна
              <br />
              Старосотнікова
            </h2>
            <div className="mt-2 h-0.5 w-12 bg-accent" />
          </div>
        </div>
        <div className="px-5 pt-5 pb-[52px]">
          <div className="mb-6 flex flex-wrap gap-1.5">
            {CREDENTIALS.map((cred) => (
              <span
                key={cred}
                className="border border-accent/25 bg-accent/4 px-3 py-1 font-label text-[8px] font-semibold tracking-[0.1em] text-white/60 uppercase"
              >
                {cred}
              </span>
            ))}
          </div>
          <div className="space-y-3.5 border-l-2 border-accent/25 pl-4 text-[13px] leading-7">
            <p className="text-white/75">
              Персональна тренерка та спортсменка IFBB Bikini.
            </p>
            <p className="text-white/60">
              Я створила YS FITNESS, щоб дати тобі не просто набір вправ, а
              зрозумілу систему, за якою можна тренуватись самостійно та бачити
              свій прогрес.
            </p>
            <p className="text-white/60">
              Мій підхід — тренування з логікою, дисципліна без крайнощів і
              робота на реальний результат.
            </p>
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="border-t border-white/6 px-5 py-14">
        <p className="mb-2 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
          У складі
        </p>
        <h2 className="font-heading text-[1.9rem] font-normal uppercase leading-tight tracking-tight">
          Що входить
        </h2>
        <ul className="mt-7">
          {INCLUDED.map((item) => (
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
            YS Fitness
          </p>
          <h2 className="font-heading text-[1.9rem] font-normal uppercase leading-tight tracking-tight">
            Твій результат
            <br />
            починається
            <br />
            із системи
          </h2>
          <div className="mx-auto my-5 h-px w-12 bg-accent" />
          <p className="mx-auto mb-8 max-w-[17.5rem] text-[13px] leading-6 text-white/50">
            Пройди коротке опитування та отримай програму відповідно до своєї
            цілі.
          </p>
          <Link href="/register">
            <Button>Почати зміни</Button>
          </Link>
          <p className="mt-4 text-[10px] tracking-wide text-white/20">
            Займає 3 хвилини
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
          {FOOTER_LINKS.map((label) => (
            <span
              key={label}
              className="font-label text-[9px] font-medium tracking-[0.1em] text-white/30 uppercase"
            >
              {label}
            </span>
          ))}
        </div>
        <p className="text-[10px] leading-5 text-white/18">
          © 2026 YS FITNESS. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
