'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@repo/validation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getUserFacingError } from '@/lib/api/errors';
import { useRegister } from '@/lib/hooks/use-auth';

export const registerFormSchema = registerSchema
  .pick({ email: true, password: true })
  .extend({ confirmPassword: z.string() })
  .refine((input) => input.password === input.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Паролі не збігаються.',
  });

type RegisterFormInput = z.infer<typeof registerFormSchema>;

export function RegisterForm() {
  const router = useRouter();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (input) => {
    try {
      const result = await registerMutation.mutateAsync({
        email: input.email,
        password: input.password,
      });
      router.replace(result.destination);
    } catch {
      // The mutation error is mapped and rendered below.
    }
  });

  return (
    <AuthShell
      eyebrow="Реєстрація"
      title="Створи свій"
      highlighted="акаунт"
      description="Зареєструйся — і ми підготуємо програму навколо твоєї цілі."
      footer={
        <>
          Вже маєш акаунт?{' '}
          <Link
            className="font-semibold text-accent underline underline-offset-4"
            href="/login"
          >
            Увійти
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="email@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-red-400">Введи коректний email.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Мінімум 8 символів"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-400">
              Пароль має містити щонайменше 8 символів.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Підтвердження паролю</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Повтори пароль"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-400">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {registerMutation.error && (
          <p
            role="alert"
            className="border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
          >
            {getUserFacingError(registerMutation.error)}
          </p>
        )}

        <Button
          className="mt-3 w-full"
          type="submit"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? 'Створюємо…' : 'Створити акаунт →'}
        </Button>
      </form>
    </AuthShell>
  );
}
