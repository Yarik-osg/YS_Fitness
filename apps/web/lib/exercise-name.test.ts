import { describe, expect, it } from 'vitest';
import { exerciseName } from './exercise-name';

const row = { name: 'Тяга горизонтального блоку', nameEn: 'Seated cable row' };

describe('exerciseName', () => {
  it('uses the English name for the English locale', () => {
    expect(exerciseName(row, 'en')).toBe('Seated cable row');
  });

  it('uses the Ukrainian name for the Ukrainian locale', () => {
    expect(exerciseName(row, 'uk')).toBe('Тяга горизонтального блоку');
  });

  it('falls back to the Ukrainian name when there is no English name', () => {
    expect(exerciseName({ ...row, nameEn: '' }, 'en')).toBe(
      'Тяга горизонтального блоку',
    );
    expect(exerciseName({ ...row, nameEn: '  ' }, 'en')).toBe(
      'Тяга горизонтального блоку',
    );
  });
});
