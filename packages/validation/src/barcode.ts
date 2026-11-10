/** GS1 mod-10. 12-digit UPC-A becomes EAN-13 with a leading 0. EAN-8 stays. */
export function normalizeBarcode(input: string): string | null {
  const digits = input.trim();
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12) {
    const ean = `0${digits}`;
    return gs1Check(ean) ? ean : null;
  }
  if (digits.length === 8 || digits.length === 13) {
    return gs1Check(digits) ? digits : null;
  }
  return null;
}

export function isValidBarcode(input: string): boolean {
  return normalizeBarcode(input) !== null;
}

/** The 12-digit form stored before UPC-A was widened, when the EAN starts with 0. */
export function barcodeLookupIds(normalized: string): string[] {
  if (normalized.length === 13 && normalized.startsWith('0')) {
    return [normalized, normalized.slice(1)];
  }
  return [normalized];
}

function gs1Check(digits: string): boolean {
  const nums = [...digits].map((digit) => Number(digit));
  const check = nums.at(-1);
  if (check === undefined) return false;
  let sum = 0;
  let weight = 3;
  for (let index = nums.length - 2; index >= 0; index -= 1) {
    sum += (nums[index] ?? 0) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === check;
}
