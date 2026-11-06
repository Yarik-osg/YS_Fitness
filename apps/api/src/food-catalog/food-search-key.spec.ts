import { describe, expect, it } from 'vitest';
import { foodSearchKey } from './food-search-key.js';

describe('foodSearchKey', () => {
  it('folds case, spaces, and composed characters into one key', () => {
    expect(foodSearchKey('  MILK   pudding ')).toBe('milk pudding');
    expect(foodSearchKey('cafe\u0301')).toBe('café');
    expect(foodSearchKey('CAFÉ')).toBe('café');
  });
});
