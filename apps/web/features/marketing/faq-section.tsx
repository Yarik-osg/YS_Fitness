'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function FaqSection() {
  const t = useTranslations('marketing');
  const items = t.raw('faq.items') as { q: string; a: string }[];
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section className="border-t border-white/6 px-5 py-14">
      <p className="mb-2 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
        {t('faq.eyebrow')}
      </p>
      <h2 className="font-heading text-[1.9rem] font-normal uppercase leading-tight tracking-tight">
        {t('faq.heading')}
      </h2>

      <div className="mt-7">
        {items.map((item, index) => {
          const isOpen = openFaq === index;
          return (
            <div key={item.q} className="border-b border-white/6">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenFaq(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-3 py-4 text-left"
              >
                <span
                  className={`text-[13px] font-semibold leading-snug ${isOpen ? 'text-ink' : 'text-white/70'}`}
                >
                  {item.q}
                </span>
                <span
                  className={`grid size-6 shrink-0 place-items-center border ${isOpen ? 'border-accent text-accent' : 'border-white/15 text-white/40'}`}
                >
                  {isOpen ? '×' : '+'}
                </span>
              </button>
              {isOpen && (
                <p className="pb-4 text-xs leading-6 text-white/50">{item.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
