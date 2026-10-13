'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { getUserFacingError } from '@/lib/api/errors';
import { useResetPassword } from '@/lib/hooks/use-auth';
import {
  createResetPasswordFormSchema,
  type ResetPasswordFormInput,
} from './reset-password-form-schema';

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const reset = useResetPassword();
  const t = useTranslations('auth');
  const locale = useLocale();
  const schema = useMemo(
    () => createResetPasswordFormSchema(t('validation.passwordMismatch')),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (input) => {
    if (!token) return;
    try {
      await reset.mutateAsync({
        token,
        password: input.password,
        locale: locale === 'en' ? 'en' : 'uk',
      });
      router.replace('/login?reset=1');
    } catch {
      // The mutation error is mapped and rendered below.
    }
  });

  const linkRejected =
    !token ||
    (reset.error instanceof ApiClientError &&
      reset.error.code === 'RESET_TOKEN_INVALID');

  return (
    <AuthShell
      eyebrow={t('reset.eyebrow')}
      title={t('reset.title')}
      highlighted={t('reset.highlighted')}
      description={t('reset.description')}
      footer={
        <>
          {t('reset.footerPrompt')}{' '}
          <Link
            className="font-semibold text-accent underline underline-offset-4"
            href="/login"
          >
            {t('reset.footerLink')}
          </Link>
        </>
      }
    >
      {linkRejected ? (
        <div
          role="alert"
          className="space-y-3 border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
        >
          <p>{t('reset.invalidLink')}</p>
          <Link
            className="font-semibold text-accent underline underline-offset-4"
            href="/forgot-password"
          >
            {t('reset.requestNew')}
          </Link>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">{t('reset.passwordLabel')}</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={t('reset.passwordPlaceholder')}
              aria-invalid={Boolean(errors.password)}
              revealLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-red-400">
                {t('validation.passwordMin')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('reset.confirmLabel')}</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t('reset.confirmPlaceholder')}
              aria-invalid={Boolean(errors.confirmPassword)}
              revealLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {reset.error && (
            <p
              role="alert"
              className="border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
            >
              {getUserFacingError(reset.error, t)}
            </p>
          )}

          <Button
            className="mt-3 w-full"
            type="submit"
            disabled={reset.isPending}
          >
            {reset.isPending ? t('reset.pending') : t('reset.submit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
