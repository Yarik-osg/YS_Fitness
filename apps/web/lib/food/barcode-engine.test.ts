import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScanDetector, type ScanDetector } from './barcode-engine';

const formats = ['ean_13', 'ean_8', 'upc_a'] as const;

function installNative(supported: readonly string[]) {
  class Native implements ScanDetector {
    static getSupportedFormats() {
      return Promise.resolve(supported);
    }

    detect() {
      return Promise.resolve([]);
    }
  }
  vi.stubGlobal('BarcodeDetector', Native);
  return Native;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createScanDetector', () => {
  it('uses the native detector when it supports every format', async () => {
    const Native = installNative(formats);
    const loadPolyfill = vi.fn();
    const created = await createScanDetector(loadPolyfill);
    expect(created.usedPolyfill).toBe(false);
    expect(created.detector).toBeInstanceOf(Native);
    expect(loadPolyfill).not.toHaveBeenCalled();
  });

  it('imports the polyfill only when native support is missing', async () => {
    installNative(['qr_code']);
    const polyfill = { detect: vi.fn() };
    const loadPolyfill = vi.fn(async () => polyfill);
    const created = await createScanDetector(loadPolyfill);
    expect(created.usedPolyfill).toBe(true);
    expect(created.detector).toBe(polyfill);
    expect(loadPolyfill).toHaveBeenCalledOnce();
  });

  it('uses the polyfill when the native detector fails', async () => {
    class Native {
      static getSupportedFormats() {
        return Promise.reject(new Error('formats failed'));
      }
    }
    vi.stubGlobal('BarcodeDetector', Native);
    const polyfill = { detect: vi.fn() };
    const loadPolyfill = vi.fn(async () => polyfill);
    const created = await createScanDetector(loadPolyfill);
    expect(created.usedPolyfill).toBe(true);
    expect(created.detector).toBe(polyfill);
  });

  it('uses the polyfill when the native constructor throws', async () => {
    class Native {
      static getSupportedFormats() {
        return Promise.resolve(formats);
      }

      constructor() {
        throw new Error('native broken');
      }
    }
    vi.stubGlobal('BarcodeDetector', Native);
    const polyfill = { detect: vi.fn() };
    const loadPolyfill = vi.fn(async () => polyfill);
    const created = await createScanDetector(loadPolyfill);
    expect(created.usedPolyfill).toBe(true);
    expect(created.detector).toBe(polyfill);
  });
});
