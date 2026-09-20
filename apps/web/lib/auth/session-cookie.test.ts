import { describe, expect, it } from 'vitest';
import { parseSessionHint } from './session-cookie';

describe('parseSessionHint', () => {
  it('accepts only onboarding and complete values', () => {
    expect(parseSessionHint('onboarding')).toBe('onboarding');
    expect(parseSessionHint('complete')).toBe('complete');
    expect(parseSessionHint('expired')).toBeNull();
    expect(parseSessionHint(undefined)).toBeNull();
  });
});
