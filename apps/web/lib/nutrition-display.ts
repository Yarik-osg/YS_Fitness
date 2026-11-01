/** Whole kcal or grams. Ties round away from zero. */
export function roundHalfAwayFromZero(value: string): string {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d+)?$/.test(unsigned)) return trimmed;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  let rounded = BigInt(whole);
  if ((fraction[0] ?? '0') >= '5') rounded += 1n;
  const text = rounded.toString();
  return negative && text !== '0' ? `-${text}` : text;
}

/** Goal factor as a percent, one decimal when the factor needs it. */
export function formatGoalPercent(value: string): string {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d+)?$/.test(unsigned)) return trimmed;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const digits = `${whole}${fraction}`;
  const point = whole.length + 3;
  const head = digits.slice(0, point).padEnd(point, '0');
  const tail = digits.slice(point);
  let scaled = BigInt(head);
  if ((tail[0] ?? '0') >= '5') scaled += 1n;
  const raw = scaled.toString().padStart(2, '0');
  const splitAt = raw.length - 1;
  const major = raw.slice(0, splitAt).replace(/^0+(?=\d)/, '');
  const minor = raw.slice(splitAt).replace(/0$/, '');
  const body = minor ? `${major}.${minor}` : major;
  if (negative && body !== '0') return `−${body}%`;
  if (body !== '0') return `+${body}%`;
  return '0%';
}
