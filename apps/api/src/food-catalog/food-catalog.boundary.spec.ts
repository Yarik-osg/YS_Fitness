import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const catalogDir = path.dirname(fileURLToPath(import.meta.url));

describe('food-catalog boundary', () => {
  it('does not import the food log', () => {
    const files = readdirSync(catalogDir).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
    );
    for (const name of files) {
      const source = readFileSync(path.join(catalogDir, name), 'utf8');
      expect(source, name).not.toMatch(/food-log/);
    }
  });
});
