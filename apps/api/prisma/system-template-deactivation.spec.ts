import { describe, expect, it } from 'vitest';
import { systemTemplatesToDeactivate } from './system-template-deactivation.js';

describe('systemTemplatesToDeactivate', () => {
  it('deactivates only system templates outside the catalog', () => {
    expect(systemTemplatesToDeactivate(['WB2U', 'MB2C'])).toEqual({
      origin: 'SYSTEM',
      code: { notIn: ['WB2U', 'MB2C'] },
    });
  });

  it('deactivates every system template when the catalog is empty', () => {
    expect(systemTemplatesToDeactivate([])).toEqual({ origin: 'SYSTEM' });
  });
});
