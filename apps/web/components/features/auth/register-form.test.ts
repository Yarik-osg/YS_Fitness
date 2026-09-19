import { describe, expect, it } from 'vitest';
import { registerFormSchema } from './register-form';

describe('registerFormSchema', () => {
  it('uses the shared minimum password rule', () => {
    const result = registerFormSchema.safeParse({
      email: 'client@example.com',
      password: 'short',
      confirmPassword: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('rejects mismatched password confirmation', () => {
    const result = registerFormSchema.safeParse({
      email: 'client@example.com',
      password: 'long-enough-password',
      confirmPassword: 'different-password',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });
});
