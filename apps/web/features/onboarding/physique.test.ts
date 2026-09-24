import { describe, expect, it } from 'vitest';
import {
  physiqueAsset,
  physiqueValue,
  nearestPhysiqueLayers,
  snapPhysiquePosition,
} from './physique';

describe('physique helpers', () => {
  it('maps both tracks onto the same 0-9 scale', () => {
    expect(physiqueValue(0)).toBe('0');
    expect(physiqueValue(9)).toBe('9');
    expect(physiqueAsset('female', 4)).toBe(
      '/marketing/body-slider/female-4.svg',
    );
    expect(physiqueAsset('male', 9)).toBe('/marketing/body-slider/male-9.svg');
  });

  it('snaps a drag position onto a discrete step', () => {
    expect(snapPhysiquePosition(4.49)).toBe(4);
    expect(snapPhysiquePosition(4.5)).toBe(5);
    expect(snapPhysiquePosition(-1)).toBe(0);
    expect(snapPhysiquePosition(20)).toBe(9);
  });

  it('crossfades the two nearest layers and jumps when motion is reduced', () => {
    expect(nearestPhysiqueLayers(3.25, false)).toEqual([
      { index: 3, opacity: 0.75 },
      { index: 4, opacity: 0.25 },
    ]);
    expect(nearestPhysiqueLayers(3.25, true)).toEqual([
      { index: 3, opacity: 1 },
    ]);
  });
});
