import { describe, expect, it } from 'vitest';
import {
  foodSearchKey,
  foodSearchTerms,
  rankBySearch,
} from './food-search-key.js';

describe('foodSearchKey', () => {
  it('folds case, spaces, and composed characters into one key', () => {
    expect(foodSearchKey('  MILK   pudding ')).toBe('milk pudding');
    expect(foodSearchKey('cafe\u0301')).toBe('café');
    expect(foodSearchKey('CAFÉ')).toBe('café');
  });

  it('folds Coca-Cola, Coca Cola, and кока кола into one search', () => {
    expect(foodSearchTerms('Coca-Cola')).toBe('coca cola');
    expect(foodSearchTerms('Coca Cola')).toBe('coca cola');
    expect(foodSearchTerms('  кока   кола ')).toBe('coca cola');
    expect(foodSearchTerms('Кока-Кола')).toBe('coca cola');
  });

  it('folds Snickers and Снікерс into one search', () => {
    expect(foodSearchTerms('Snickers')).toBe('snickers');
    expect(foodSearchTerms('Снікерс')).toBe('snickers');
    expect(foodSearchTerms('СНІКЕРС')).toBe('snickers');
  });

  it('leaves a longer phrase alone', () => {
    expect(foodSearchTerms('снікерс білий')).toBe('снікерс білий');
  });
});

describe('rankBySearch', () => {
  it('keeps Original and Zero apart and puts an exact name before the brand', () => {
    const products = [
      row('soft', 'Soft drink', 'Coca-Cola'),
      row('zero', 'Coca-Cola Zero', 'Coca-Cola'),
      row('cherry', 'Coca-Cola Cherry', 'Coca-Cola'),
      row('can', 'Coca-Cola', 'Coca-Cola'),
    ];

    expect(rankBySearch(products, 'кока кола').map((item) => item.id)).toEqual([
      'can',
      'zero',
      'cherry',
      'soft',
    ]);
  });
});

function row(id: string, name: string, brand: string) {
  return { id, name, brand };
}
