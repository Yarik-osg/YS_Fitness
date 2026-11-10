import { ENTRY_MAX_KCAL, PER_100G_MAX_KCAL } from '@repo/validation';
import { describe, expect, it } from 'vitest';
import { addDays, localDateKey } from '@/lib/calendar';
import {
  formatFoodDate,
  parseCalendarDate,
  selectedFoodDate,
  shiftFoodDate,
} from './dates';
import { decodeFoodText } from './text';
import {
  entryCap,
  exceedsEntryCap,
  formatFoodAmount,
  goalState,
  gramsAccepted,
  previewMacros,
  remainingTone,
  roundHalfUp,
  scalePer100g,
  targetAsTotals,
} from './macros';
import { rankFoodProducts, sortByMacro } from './rank';

describe('food display', () => {
  it('rounds only the displayed number', () => {
    const raw = 1818.6;
    expect(formatFoodAmount(raw, 'en', 0)).toBe('1,819');
    expect(raw).toBe(1818.6);
    expect(formatFoodAmount(235.4, 'en', 0)).toBe('235');
    expect(scalePer100g(130, 80)).toBe(104);
  });

  it('marks under, met, and over without letting the bar pass 100', () => {
    expect(goalState(150, 180).state).toBe('under');
    expect(goalState(180, 180).state).toBe('met');
    const over = goalState(235, 180);
    expect(over.state).toBe('over');
    expect(over.overBy).toBe(55);
    expect(over.width).toBe(100);
    expect(goalState(360, 180).width).toBeLessThanOrEqual(100);
  });
});

describe('food search order', () => {
  it('keeps every result and prefers the exact name', () => {
    const products = [
      product('Rice chips'),
      product('Brown rice'),
      product('рис'),
      product('Rice'),
    ];
    expect(
      rankFoodProducts(products, ' rice ').map((item) => item.name),
    ).toEqual(['Rice', 'Rice chips', 'Brown rice', 'рис']);
    expect(rankFoodProducts(products, 'рис').map((item) => item.name)[0]).toBe(
      'рис',
    );
  });

  it('ranks Coca-Cola ahead of Zero and a brand-only match', () => {
    const products = [
      { ...product('Soft drink'), brand: 'Coca-Cola' },
      { ...product('Coca-Cola Zero'), brand: 'Coca-Cola' },
      { ...product('Coca-Cola'), brand: 'Coca-Cola' },
    ];
    expect(
      rankFoodProducts(products, 'кока кола').map((item) => item.name),
    ).toEqual(['Coca-Cola', 'Coca-Cola Zero', 'Soft drink']);
  });

  it('sorts custom and favorite foods by a macro, highest first', () => {
    const oats = {
      ...product('Oats'),
      source: 'CUSTOM' as const,
      proteinPer100g: 13,
    };
    const liked = { ...product('Milk'), isFavorite: true, proteinPer100g: 3 };
    const other = { ...product('Chips'), proteinPer100g: 20 };
    expect(
      sortByMacro([other, liked, oats], 'protein').map((item) => item.name),
    ).toEqual(['Oats', 'Milk', 'Chips']);
  });
});

function product(name: string) {
  return {
    id: name,
    source: 'OFF' as const,
    externalId: null,
    barcode: null,
    name,
    brand: null,
    imageUrl: null,
    kcalPer100g: 1,
    proteinPer100g: 1,
    fatPer100g: 1,
    carbsPer100g: 1,
    isFavorite: false,
  };
}

describe('food text', () => {
  it('turns stored quote entities into quotation marks', () => {
    expect(decodeFoodText('Вівсянка &quot;Овернайт&quot;')).toBe(
      'Вівсянка "Овернайт"',
    );
    expect(decodeFoodText('A &amp; B')).toBe('A & B');
    expect(decodeFoodText('&amp;quot;')).toBe('"');
    expect(decodeFoodText('&#1114112;')).toBe('&#1114112;');
    expect(decodeFoodText('&#34;')).toBe('"');
  });
});

describe('food dates', () => {
  it('keeps the local calendar day around midnight and across a DST jump', () => {
    expect(localDateKey(new Date(2026, 2, 28, 23, 30))).toBe('2026-03-28');
    expect(localDateKey(new Date(2026, 2, 29, 0, 30))).toBe('2026-03-29');
    const beforeSpringForward = new Date(2026, 2, 28, 23, 30);
    expect(localDateKey(addDays(beforeSpringForward, 1))).toBe('2026-03-29');
    expect(shiftFoodDate('2026-03-28', 1)).toBe('2026-03-29');
  });

  it('parses and displays a calendar date without a UTC shift', () => {
    const parsed = parseCalendarDate('2026-03-29');
    expect(parsed).not.toBeNull();
    expect(localDateKey(parsed as Date)).toBe('2026-03-29');
    expect(parseCalendarDate('2026-02-31')).toBeNull();
    expect(formatFoodDate('2026-03-29', 'en')).toContain('29');
    expect(selectedFoodDate('2026-02-31', new Date(2026, 0, 2, 0, 30))).toBe(
      '2026-01-02',
    );
    expect(selectedFoodDate('2026-01-05', new Date(2026, 0, 2))).toBe(
      '2026-01-05',
    );
  });
});

describe('food macros', () => {
  it('rounds half up to one decimal', () => {
    expect(roundHalfUp(1.25, 1)).toBe(1.3);
    expect(roundHalfUp(1.24, 1)).toBe(1.2);
    expect(scalePer100g(130, 80)).toBe(104);
    expect(gramsAccepted(10.2)).toBe(true);
    expect(gramsAccepted(10.25)).toBe(false);
    expect(gramsAccepted(0.05)).toBe(false);
    expect(
      previewMacros(
        {
          kcalPer100g: 130,
          proteinPer100g: 2.5,
          fatPer100g: 0.3,
          carbsPer100g: 28,
        },
        150,
      ),
    ).toEqual({ kcal: 195, protein: 3.8, fat: 0.5, carbs: 42 });
  });

  it('rejects values above the shared cap for those grams', () => {
    expect(entryCap(100, 'kcal')).toBe(PER_100G_MAX_KCAL);
    expect(entryCap(5000, 'kcal')).toBe(ENTRY_MAX_KCAL);
    expect(
      exceedsEntryCap(100, { kcal: 1000, protein: 10, fat: 10, carbs: 10 }),
    ).toBe(false);
    expect(
      exceedsEntryCap(100, { kcal: 1000.1, protein: 10, fat: 10, carbs: 10 }),
    ).toBe(true);
    expect(
      exceedsEntryCap(50, { kcal: 10, protein: 50, fat: 10, carbs: 10 }),
    ).toBe(false);
    expect(
      exceedsEntryCap(50, { kcal: 10, protein: 50.1, fat: 10, carbs: 10 }),
    ).toBe(true);
  });

  it('maps a target onto the totals shape and names an overrun', () => {
    expect(
      targetAsTotals({
        source: 'CALCULATED',
        targetCalories: 2000,
        proteinGrams: 150,
        fatGrams: 60,
        carbsGrams: 220,
      }),
    ).toEqual({ kcal: 2000, protein: 150, fat: 60, carbs: 220 });
    expect(remainingTone(12)).toEqual({ tone: 'left', amount: 12 });
    expect(remainingTone(0)).toEqual({ tone: 'left', amount: 0 });
    expect(remainingTone(-40)).toEqual({ tone: 'over', amount: 40 });
  });
});
