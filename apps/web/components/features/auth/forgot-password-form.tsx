'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@repo/validation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { getUserFacingError } from '@/lib/api/errors';
import { useForgotPassword } from '@/lib/hooks/use-auth';

const formSchema = forgotPasswordSchema.pick({ email: true });

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (input) => {
    try {
      await forgot.mutateAsync({
        email: input.email,
        locale: locale === 'en' ? 'en' : 'uk',
      });
    } catch {
      // The mutation error is mapped and rendered below.
    }
  });

  return (
    <AuthShell
      eyebrow={t('forgot.eyebrow')}
      title={t('forgot.title')}
      highlighted={t('forgot.highlighted')}
      description={t('forgot.description')}
      footer={
        <>
          {t('forgot.footerPrompt')}{' '}
          <Link
            className="font-semibold text-accent underline underline-offset-4"
            href="/login"
          >
            {t('forgot.footerLink')}
          </Link>
        </>
      }
    >
      {forgot.isSuccess ? (
        <p
          role="status"
          className="border-l-2 border-accent bg-accent/8 px-4 py-3 text-xs leading-6 text-ink"
        >
          {t('forgot.sent')}
        </p>
      ) : (
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

          {forgot.error && (
            <p
              role="alert"
              className="border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
            >
              {getUserFacingError(forgot.error, t)}
            </p>
          )}

          <Button
            className="mt-3 w-full"
            type="submit"
            disabled={forgot.isPending}
          >
            {forgot.isPending ? t('forgot.pending') : t('forgot.submit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
