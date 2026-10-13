import { resetPasswordSchema } from '@repo/validation';
import { z } from 'zod';

export function createResetPasswordFormSchema(passwordMismatch: string) {
  return resetPasswordSchema
    .pick({ password: true })
    .extend({ confirmPassword: z.string() })
    .refine((input) => input.password === input.confirmPassword, {
      path: ['confirmPassword'],
      message: passwordMismatch,
    });
}

export type ResetPasswordFormInput = z.infer<
  ReturnType<typeof createResetPasswordFormSchema>
>;
