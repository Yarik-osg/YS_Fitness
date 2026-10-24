import { describe, expect, it } from 'vitest';
import { programTitle } from './program-title';

describe('programTitle', () => {
  const titleFor = (accent: string) => `name:${accent}`;

  it('uses the focus name and leaves the catalog code out of the title', () => {
    expect(programTitle('UPPER', titleFor, 'Program')).toBe('name:UPPER');
    expect(programTitle('NONE', titleFor, 'Program')).toBe('name:NONE');
  });

  it('falls back when the focus is missing or not one of the catalog accents', () => {
    expect(programTitle('WP4', titleFor, 'Program')).toBe('Program');
    expect(programTitle('', titleFor, 'Program')).toBe('Program');
  });
});
