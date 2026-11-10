import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(webRoot, 'package.json'));
const installed = dirname(realpathSync(require.resolve('barcode-detector')));

function readerWasm(start) {
  let dir = start;
  for (let hop = 0; hop < 8; hop += 1) {
    const candidate = join(dir, 'zxing-wasm/dist/reader/zxing_reader.wasm');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    'zxing reader wasm was not installed next to barcode-detector',
  );
}

const destinationDir = join(webRoot, 'public/zxing');
mkdirSync(destinationDir, { recursive: true });
copyFileSync(readerWasm(installed), join(destinationDir, 'zxing_reader.wasm'));
