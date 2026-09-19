'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@repo/validation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';
import { getUserFacingError } from '@/lib/api/errors';
import { useLogin } from '@/lib/hooks/use-auth';

const loginFormSchema = loginSchema.pick({ email: true, password: true });
type LoginFormInput = Pick<LoginInput, 'email' | 'password'>;

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const t = useTranslations('auth');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (input) => {
    try {
      const result = await login.mutateAsync(input);
      router.replace(result.destination);
    } catch {
      // The mutation error is mapped and rendered below.
    }
  });

  return (
    <AuthShell
      eyebrow={t('login.eyebrow')}
      title={t('login.title')}
      highlighted={t('login.highlighted')}
      description={t('login.description')}
      footer={
        <>
          {t('login.footerPrompt')}{' '}
          <Link
            className="font-semibold text-accent underline underline-offset-4"
            href="/register"
          >
            {t('login.footerLink')}
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
          <Label htmlFor="password">{t('login.passwordLabel')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('login.passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-400">
              {t('validation.passwordMin')}
            </p>
          )}
        </div>

        {login.error && (
          <p
            role="alert"
            className="border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
          >
            {getUserFacingError(login.error, t)}
          </p>
        )}

        <Button
          className="mt-3 w-full"
          type="submit"
          disabled={login.isPending}
        >
          {login.isPending ? t('login.pending') : t('login.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
