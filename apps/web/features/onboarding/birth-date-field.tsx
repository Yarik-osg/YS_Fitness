'use client';

import { ChevronDown } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState } from 'react';

type Part = 'day' | 'month' | 'year';
type Parts = Record<Part, string>;

const NAMES = {
  en: { day: 'Day', month: 'Month', year: 'Year' },
  uk: { day: 'День', month: 'Місяць', year: 'Рік' },
} as const;

function split(value?: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return { year: '', month: '', day: '' };
  return {
    year: String(Number(match[1])),
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
}

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayCount(
  year: number,
  month: number,
  latest: { year: number; month: number; day: number },
) {
  const length = daysInMonth(year, month);
  if (year === latest.year && month === latest.month) {
    return Math.min(length, latest.day);
  }
  return length;
}

function range(from: number, to: number) {
  const values: number[] = [];
  for (let value = from; value <= to; value += 1) values.push(value);
  return values;
}

/**
 * Birthday is three numbers, so this is three native selects rather than a
 * month grid. The limits match isPlausibleDateOfBirth, which reads the date
 * as UTC midnight.
 */
export function BirthDateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  const locale = useLocale();
  const names = locale === 'en' ? NAMES.en : NAMES.uk;
  const now = new Date();
  const latest = utcParts(now);
  const oldest = utcParts(
    new Date(Date.UTC(latest.year - 120, latest.month - 1, latest.day)),
  );
  const [source, setSource] = useState(value);
  const [draft, setDraft] = useState(() => split(value));
  if (value !== source) {
    setSource(value);
    setDraft(split(value));
  }

  const monthStart = Number(draft.year) === oldest.year ? oldest.month : 1;
  const monthEnd = Number(draft.year) === latest.year ? latest.month : 12;
  const dayStart =
    Number(draft.year) === oldest.year && Number(draft.month) === oldest.month
      ? oldest.day
      : 1;
  const dayEnd = dayCount(
    Number(draft.year) || latest.year,
    Number(draft.month) || 1,
    latest,
  );

  const months = range(monthStart, monthEnd).map((month) => ({
    value: String(month),
    label: new Intl.DateTimeFormat(locale, {
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2020, month - 1, 1))),
  }));
  const days = range(dayStart, dayEnd).map(String);
  const years = range(oldest.year, latest.year).reverse().map(String);
  const order: Part[] =
    locale === 'en' ? ['month', 'day', 'year'] : ['day', 'month', 'year'];

  function choose(part: Part, nextValue: string) {
    if (!nextValue) return;
    const next = { ...draft, [part]: nextValue };
    const year = Number(next.year);
    const month = Number(next.month);
    const day = Number(next.day);
    if (year === latest.year && month > latest.month)
      next.month = String(latest.month);
    if (year === oldest.year && month && month < oldest.month) {
      next.month = String(oldest.month);
    }
    const chosenMonth = Number(next.month);
    const lengthYear = year || latest.year;
    const maxDay = chosenMonth ? dayCount(lengthYear, chosenMonth, latest) : 0;
    if (chosenMonth && day > maxDay) {
      next.day = String(maxDay);
    }
    if (
      year === oldest.year &&
      chosenMonth === oldest.month &&
      Number(next.day) &&
      Number(next.day) < oldest.day
    ) {
      next.day = String(oldest.day);
    }
    setDraft(next);
    if (next.year && next.month && next.day) {
      onChange(
        `${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}`,
      );
    }
  }

  const options: Record<Part, { value: string; label: string }[]> = {
    day: days.map((day) => ({ value: day, label: day })),
    month: months,
    year: years.map((year) => ({ value: year, label: year })),
  };

  return (
    <div>
      <span
        id={id}
        className="mb-2 block font-label text-[9px] font-semibold tracking-[0.16em] text-white/50 uppercase"
      >
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex gap-2">
        {order.map((part) => {
          const selected = options[part].find(
            (option) => option.value === draft[part],
          );
          return (
            <div
              key={part}
              className={`relative border border-white/12 bg-white/4 focus-within:border-accent ${part === 'month' ? 'min-w-0 flex-1' : 'w-[5.25rem]'}`}
            >
              <span
                className={`pointer-events-none block truncate py-3 pr-7 pl-3 font-heading text-[18px] leading-none ${selected ? 'text-white' : 'text-white/35'}`}
              >
                {selected?.label ?? '—'}
              </span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-white/40"
              />
              <select
                aria-label={names[part]}
                value={draft[part]}
                onChange={(event) => choose(part, event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="">—</option>
                {options[part].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
