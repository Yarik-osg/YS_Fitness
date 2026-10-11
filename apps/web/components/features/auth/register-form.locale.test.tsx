import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { RegisterForm } from './register-form';

const register = vi.hoisted(() => vi.fn());

vi.mock('@/lib/hooks/use-auth', () => ({
  useRegister: () => ({
    mutateAsync: register,
    isPending: false,
    error: null,
  }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/register',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe('RegisterForm locale', () => {
  afterEach(() => {
    cleanup();
    register.mockReset();
  });

  it.each([
    ['uk', 'Пароль', 'Підтвердження паролю', 'Створити акаунт →'],
    ['en', 'Password', 'Confirm password', 'Create account →'],
  ] as const)(
    'sends the %s locale with the registration',
    async (locale, passwordLabel, confirmLabel, submitLabel) => {
      const user = userEvent.setup();
      register.mockResolvedValue({ destination: '/dashboard' });
      render(
        <I18nTestProvider locale={locale}>
          <RegisterForm />
        </I18nTestProvider>,
      );

      await user.type(screen.getByLabelText('Email'), 'olena@example.com');
      await user.type(screen.getByLabelText(passwordLabel), 'strong-password');
      await user.type(screen.getByLabelText(confirmLabel), 'strong-password');
      await user.click(screen.getByRole('button', { name: submitLabel }));

      await waitFor(() => {
        expect(register).toHaveBeenCalledWith({
          email: 'olena@example.com',
          password: 'strong-password',
          locale,
        });
      });
    },
  );
});
