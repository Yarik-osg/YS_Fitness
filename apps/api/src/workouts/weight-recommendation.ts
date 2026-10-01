export type WeightRecommendation = 'increase' | 'decrease';

export function weightRecommendation(
  repsCompleted: number | null,
  repsMin: number,
  repsMax: number,
): WeightRecommendation | null {
  if (repsCompleted == null) return null;
  if (repsCompleted >= repsMax) return 'increase';
  if (repsCompleted < repsMin) return 'decrease';
  return null;
}
