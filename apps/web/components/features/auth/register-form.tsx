'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';
import { getUserFacingError } from '@/lib/api/errors';
import { useRegister } from '@/lib/hooks/use-auth';
import {
  createRegisterFormSchema,
  registerFormSchema,
} from './register-form-schema';

type RegisterFormInput = z.infer<typeof registerFormSchema>;

export function RegisterForm() {
  const router = useRouter();
  const registerMutation = useRegister();
  const t = useTranslations('auth');
  const schema = useMemo(
    () => createRegisterFormSchema(t('validation.passwordMismatch')),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(schema),
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
      eyebrow={t('register.eyebrow')}
      title={t('register.title')}
      highlighted={t('register.highlighted')}
      description={t('register.description')}
      footer={
        <>
          {t('register.footerPrompt')}{' '}
          <Link
            className="font-semibold text-accent underline underline-offset-4"
            href="/login"
          >
            {t('register.footerLink')}
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
            <p className="text-xs text-red-400">{t('validation.email')}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('register.passwordLabel')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t('register.passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-400">
              {t('validation.passwordMin')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('register.confirmLabel')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder={t('register.confirmPlaceholder')}
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-400">
              {t('validation.passwordMismatch')}
            </p>
          )}
        </div>

        {registerMutation.error && (
          <p
            role="alert"
            className="border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
          >
            {getUserFacingError(registerMutation.error, t)}
          </p>
        )}

        <Button
          className="mt-3 w-full"
          type="submit"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending
            ? t('register.pending')
            : t('register.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
