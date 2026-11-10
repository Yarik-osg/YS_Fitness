import { isValidBarcode, normalizeBarcode } from '@repo/validation';
import { describe, expect, it } from 'vitest';
import { confirmDetection, isScanFormat } from './barcode';

describe('confirmDetection', () => {
  it('accepts a code only after two identical allowed reads', () => {
    const first = confirmDetection(null, {
      rawValue: '4006381333931',
      format: 'ean_13',
    });
    expect(first.code).toBeNull();
    const second = confirmDetection(first.previous, {
      rawValue: '4006381333931',
      format: 'ean_13',
    });
    expect(second.code).toBe('4006381333931');
  });

  it('ignores formats outside the whitelist and restarts after a different code', () => {
    expect(isScanFormat('qr_code')).toBe(false);
    const ignored = confirmDetection('4006381333931', {
      rawValue: 'https://example.test',
      format: 'qr_code',
    });
    expect(ignored).toEqual({ previous: '4006381333931', code: null });
    const other = confirmDetection('4006381333931', {
      rawValue: '036000291452',
      format: 'upc_a',
    });
    expect(other.code).toBeNull();
    expect(other.previous).toBe('0036000291452');
  });
});

describe('typed barcodes', () => {
  it('accepts a valid code, rejects a bad checksum, and rejects 7 or 14 digits', () => {
    expect(isValidBarcode('4006381333931')).toBe(true);
    expect(normalizeBarcode('4006381333932')).toBeNull();
    expect(normalizeBarcode('1234567')).toBeNull();
    expect(normalizeBarcode('40063813339310')).toBeNull();
  });

  it('normalizes a 12-digit UPC-A to 13 digits', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
  });
});
