'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function FaqSection() {
  const t = useTranslations('marketing');
  const items = t.raw('faq.items') as { q: string; a: string }[];
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section className="border-t border-white/6 px-5 py-[52px]">
      <p className="mb-2.5 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
        {t('faq.eyebrow')}
      </p>
      <h2 className="font-heading text-[30px] font-normal uppercase leading-[1.1] tracking-[-0.02em]">
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
                className="flex w-full items-center justify-between gap-3 py-[18px] text-left"
              >
                <span
                  className={`text-[13px] font-semibold leading-[1.45] ${isOpen ? 'text-ink' : 'text-white/70'}`}
                >
                  {item.q}
                </span>
                <span
                  className={`grid size-6 shrink-0 place-items-center border transition-colors ${isOpen ? 'border-accent' : 'border-white/15'}`}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                  >
                    <path
                      d="M5 1v8M1 5h8"
                      stroke={isOpen ? '#35f5e8' : 'rgba(255,255,255,0.4)'}
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
              {isOpen && (
                <p className="pb-[18px] text-[12px] leading-[1.7] text-white/50">
                  {item.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
