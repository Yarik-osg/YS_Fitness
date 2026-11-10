import { normalizeBarcode } from '@repo/validation';

/** Formats the camera and the photo decoder are allowed to accept. */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const;

export type ScanFormat = (typeof BARCODE_FORMATS)[number];

export function isScanFormat(format: string): format is ScanFormat {
  return (BARCODE_FORMATS as readonly string[]).includes(format);
}

/**
 * A live frame counts only when the format is allowed and the digits pass
 * the shared checksum. The code is returned after two identical reads in a row.
 * A different code, or a bad read of an allowed format, starts the pair over.
 * Any other format is ignored so it does not break a pair.
 */
export function confirmDetection(
  previous: string | null,
  read: { rawValue: string; format: string },
): { previous: string | null; code: string | null } {
  if (!isScanFormat(read.format)) return { previous, code: null };
  const code = normalizeBarcode(read.rawValue);
  if (!code) return { previous: null, code: null };
  if (previous === code) return { previous: code, code };
  return { previous: code, code: null };
}
