const NAMED: Record<string, string> = {
  quot: '"',
  apos: "'",
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: '\u00a0',
};

/** Open Food Facts sometimes stores quotes as `&quot;`. Show the character. */
export function decodeFoodText(value: string): string {
  let current = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = current.replace(
      /&(?:#(\d+)|#x([\da-fA-F]+)|([a-zA-Z]+));/g,
      (
        entity,
        dec: string | undefined,
        hex: string | undefined,
        name: string | undefined,
      ) => {
        if (dec) return character(Number(dec)) ?? entity;
        if (hex) return character(Number.parseInt(hex, 16)) ?? entity;
        if (name && Object.hasOwn(NAMED, name)) return NAMED[name] ?? entity;
        return entity;
      },
    );
    if (next === current) return current;
    current = next;
  }
  return current;
}

function character(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return null;
  if (value >= 0xd800 && value <= 0xdfff) return null;
  return String.fromCodePoint(value);
}
