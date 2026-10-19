import { describe, expect, it } from 'vitest';
import { isHeicFile } from './progress-photo';

describe('isHeicFile', () => {
  it('recognizes an iPhone photo even when the browser omits the type', () => {
    expect(isHeicFile({ name: 'IMG_2041.HEIC', type: '' })).toBe(true);
    expect(isHeicFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);
  });
});
