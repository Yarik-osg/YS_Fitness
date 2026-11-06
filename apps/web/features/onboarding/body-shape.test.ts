import { describe, expect, it } from 'vitest';
import {
  clampShape,
  currentBodyFromMuscle,
  muscleFromCurrentBody,
  shapeAnswers,
  shapeBand,
  SHAPE_DEFAULT,
} from './body-shape';

describe('body shape scale', () => {
  it('starts at a neutral value and labels the middle as moderate', () => {
    expect(SHAPE_DEFAULT).toBe(50);
    expect(shapeBand(SHAPE_DEFAULT)).toBe('moderate');
    expect(shapeBand(0)).toBe('low');
    expect(shapeBand(100)).toBe('high');
  });

  it('keeps muscle and fat independent when either slider moves', () => {
    const lean = shapeAnswers(90, 10);
    const soft = shapeAnswers(90, 90);
    expect(lean.muscleDevelopment).toBe(soft.muscleDevelopment);
    expect(lean.bodyFatLevel).not.toBe(soft.bodyFatLevel);
    expect(shapeAnswers(10, 90).muscleDevelopment).toBe(10);
    expect(shapeAnswers(10, 90).bodyFatLevel).toBe(90);
  });

  it('clamps the stored scale and keeps the old 0-9 body index in range', () => {
    expect(clampShape(-4)).toBe(0);
    expect(clampShape(140)).toBe(100);
    expect(currentBodyFromMuscle(0)).toBe('0');
    expect(currentBodyFromMuscle(100)).toBe('9');
    expect(muscleFromCurrentBody('0')).toBe(0);
    expect(muscleFromCurrentBody('9')).toBe(100);
    expect(currentBodyFromMuscle(muscleFromCurrentBody('4'))).toBe('4');
  });
});
