import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { LoginForm } from './login-form';

const nav = vi.hoisted(() => ({ query: '' }));

vi.mock('@/lib/hooks/use-auth', () => ({
  useLogin: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
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
  usePathname: () => '/login',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.query),
}));

function renderForm(locale: 'uk' | 'en' = 'en') {
  return render(
    <I18nTestProvider locale={locale}>
      <LoginForm />
    </I18nTestProvider>,
  );
}

describe('LoginForm password recovery', () => {
  afterEach(() => {
    cleanup();
    nav.query = '';
  });

  it('links to the forgot-password page in both languages', () => {
    renderForm('en');
    expect(
      screen.getByRole('link', { name: 'Forgot your password?' }),
    ).toHaveAttribute('href', '/forgot-password');
    cleanup();

    renderForm('uk');
    expect(
      screen.getByRole('link', { name: "Не пам'ятаєш пароль?" }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('confirms a finished reset only when the URL says so', () => {
    renderForm('en');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    cleanup();

    nav.query = '?reset=1';
    renderForm('en');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Password changed. Log in with your new password.',
    );
  });
});
