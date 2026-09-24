import { describe, expect, it } from 'vitest';
import { bodySliderSrc, isLocalSvg } from './body-figure';

describe('bodySliderSrc', () => {
  it('points at the local body-slider assets', () => {
    expect(bodySliderSrc('female', 2)).toBe(
      '/marketing/body-slider/female-2.svg',
    );
    expect(bodySliderSrc('male', 8)).toBe('/marketing/body-slider/male-8.svg');
    expect(isLocalSvg('/marketing/body-slider/male-0.svg')).toBe(true);
    expect(isLocalSvg('/marketing/hero.png')).toBe(false);
  });
});
