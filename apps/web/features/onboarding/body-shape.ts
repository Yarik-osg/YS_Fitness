export const SHAPE_DEFAULT = 50;

export function clampShape(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Subjective band. The stored number is not a body-composition percent. */
export function shapeBand(value: number): 'low' | 'moderate' | 'high' {
  const clamped = clampShape(value);
  if (clamped < 34) return 'low';
  if (clamped < 67) return 'moderate';
  return 'high';
}

export function currentBodyFromMuscle(muscle: number) {
  return String(Math.round((clampShape(muscle) / 100) * 9));
}

export function muscleFromCurrentBody(currentBody?: string) {
  if (currentBody && /^[0-9]$/.test(currentBody)) {
    return Math.round((Number(currentBody) / 9) * 100);
  }
  return SHAPE_DEFAULT;
}

export function shapeAnswers(muscle: number, fat: number) {
  const muscleDevelopment = clampShape(muscle);
  const bodyFatLevel = clampShape(fat);
  const currentBody = currentBodyFromMuscle(muscleDevelopment);
  return {
    muscleDevelopment,
    bodyFatLevel,
    currentBody,
    physiqueLevel: currentBody,
  };
}
