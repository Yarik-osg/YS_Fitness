'use client';

import { enUS, uk } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { useState, type CSSProperties } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

function parseIso(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Date of birth control. The calendar is react-day-picker so the dark theme
 * and the 120-year limit stay the same in every browser.
 */
export function BirthDateField({
  id,
  value,
  onChange,
}: {
  id: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  const locale = useLocale();
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const today = new Date();
  const earliest = new Date(
    today.getFullYear() - 120,
    today.getMonth(),
    today.getDate(),
  );
  const shown = selected
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(selected)
    : '—';

  return (
    <div>
      <button
        id={id}
        type="button"
        aria-expanded={open}
        className="w-full text-left font-heading text-[18px] text-white"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? undefined : 'text-white/25'}>{shown}</span>
      </button>
      {open ? (
        <DayPicker
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date(today.getFullYear() - 25, 0)}
          onSelect={(day) => {
            if (!day) return;
            onChange(toIso(day));
            setOpen(false);
          }}
          locale={locale === 'uk' ? uk : enUS}
          weekStartsOn={locale === 'uk' ? 1 : 0}
          captionLayout="dropdown"
          startMonth={earliest}
          endMonth={today}
          disabled={{ before: earliest, after: today }}
          className="mt-3"
          style={
            {
              '--rdp-accent-color': '#c8ff2e',
              '--rdp-accent-background-color': 'rgba(200, 255, 46, 0.16)',
              '--rdp-today-color': '#35f5e8',
              color: '#fff',
            } as CSSProperties
          }
        />
      ) : null}
    </div>
  );
}
