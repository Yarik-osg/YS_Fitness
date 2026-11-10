import { BARCODE_FORMATS } from './barcode';

/** Same-origin copy of zxing-wasm's reader build. Nothing is loaded from a CDN. */
export const BARCODE_WASM_URL = '/zxing/zxing_reader.wasm';

export interface ScanDetector {
  detect(
    source: CanvasImageSource,
  ): Promise<Array<{ rawValue: string; format: string }>>;
}

type DetectorConstructor = {
  new (options?: { formats?: readonly string[] }): ScanDetector;
  getSupportedFormats?: () => Promise<readonly string[]>;
};

function nativeDetector(): DetectorConstructor | undefined {
  return (globalThis as { BarcodeDetector?: DetectorConstructor })
    .BarcodeDetector;
}

export async function loadPolyfillDetector(): Promise<ScanDetector> {
  const { BarcodeDetector, prepareZXingModule } =
    await import('barcode-detector/ponyfill');
  prepareZXingModule({
    overrides: {
      locateFile(path: string, prefix: string) {
        if (path.endsWith('.wasm')) return BARCODE_WASM_URL;
        return `${prefix}${path}`;
      },
    },
  });
  return new BarcodeDetector({ formats: [...BARCODE_FORMATS] });
}

/** Native detector when it supports every format, otherwise the ZXing polyfill. */
export async function createScanDetector(
  loadPolyfill: () => Promise<ScanDetector> = loadPolyfillDetector,
): Promise<{ detector: ScanDetector; usedPolyfill: boolean }> {
  try {
    const Native = nativeDetector();
    if (Native?.getSupportedFormats) {
      const supported = await Native.getSupportedFormats();
      const ready = BARCODE_FORMATS.every((format) =>
        supported.includes(format),
      );
      if (ready) {
        return {
          detector: new Native({ formats: [...BARCODE_FORMATS] }),
          usedPolyfill: false,
        };
      }
    }
  } catch {
    // A native detector can reject or throw and still leave the camera usable.
  }
  return { detector: await loadPolyfill(), usedPolyfill: true };
}
