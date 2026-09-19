import { registerSchema } from '@repo/validation';
import { z } from 'zod';

export function createRegisterFormSchema(passwordMismatch: string) {
  return registerSchema
    .pick({ email: true, password: true })
    .extend({ confirmPassword: z.string() })
    .refine((input) => input.password === input.confirmPassword, {
      path: ['confirmPassword'],
      message: passwordMismatch,
    });
}

export const registerFormSchema = createRegisterFormSchema(
  'Passwords do not match.',
);
