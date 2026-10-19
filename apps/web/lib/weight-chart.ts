export function formatWeight(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDelta(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  })
    .format(value)
    .replace(/^-/, '−');
}

/** One tick per local calendar day, on that day's first point. */
export function oneLabelPerDay(times: number[]) {
  const seen = new Set<string>();
  return times.filter((time) => {
    const date = new Date(time);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function latestMeasurement<T extends { id: string; measuredAt: string }>(
  points: T[],
): T | null {
  return points.reduce<T | null>((best, point) => {
    if (!best) return point;
    const byTime = Date.parse(point.measuredAt) - Date.parse(best.measuredAt);
    if (byTime !== 0) return byTime > 0 ? point : best;
    return point.id > best.id ? point : best;
  }, null);
}
