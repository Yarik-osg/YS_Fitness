import { describe, expect, it } from 'vitest';
import { weightRecommendation } from './weight-recommendation.js';

describe('weightRecommendation', () => {
  it('uses a 10–12 range, including the boundaries', () => {
    expect(weightRecommendation(12, 10, 12)).toBe('increase');
    expect(weightRecommendation(13, 10, 12)).toBe('increase');
    expect(weightRecommendation(11, 10, 12)).toBeNull();
    expect(weightRecommendation(10, 10, 12)).toBeNull();
    expect(weightRecommendation(9, 10, 12)).toBe('decrease');
    expect(weightRecommendation(null, 10, 12)).toBeNull();
  });

  it('uses a 12–15 range rather than hardcoded bounds', () => {
    expect(weightRecommendation(15, 12, 15)).toBe('increase');
    expect(weightRecommendation(16, 12, 15)).toBe('increase');
    expect(weightRecommendation(14, 12, 15)).toBeNull();
    expect(weightRecommendation(12, 12, 15)).toBeNull();
    expect(weightRecommendation(11, 12, 15)).toBe('decrease');
    expect(weightRecommendation(null, 12, 15)).toBeNull();
  });
});
