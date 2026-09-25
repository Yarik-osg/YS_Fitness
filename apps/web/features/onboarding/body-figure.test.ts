import { describe, expect, it } from 'vitest';
import {
  bodySliderSrc,
  currentBodyPhoto,
  desiredBodyPhoto,
  isLocalSvg,
} from './body-figure';

describe('bodySliderSrc', () => {
  it('points at the local body assets', () => {
    expect(bodySliderSrc('male', 6)).toBe('/marketing/body-slider/male-6.svg');
    expect(isLocalSvg(bodySliderSrc('male', 6))).toBe(true);
    expect(isLocalSvg('/marketing/hero.png')).toBe(false);
    expect(currentBodyPhoto('female', 0)).toBe(
      '/marketing/body-current/female-01.jpg',
    );
    expect(currentBodyPhoto('male', 9)).toBe(
      '/marketing/body-current/male-10.jpg',
    );
    expect(desiredBodyPhoto('female', 3)).toBe(
      '/marketing/body-desired/female-4.jpg',
    );
    expect(isLocalSvg(desiredBodyPhoto('male', 0))).toBe(false);
  });
});
