import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { useAuthStore } from '@/lib/stores/auth-store';
import { I18nTestProvider } from '@/test/i18n';
import { ResetPasswordForm } from './reset-password-form';

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  query: '?token=' + 't'.repeat(43),
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
  usePathname: () => '/reset-password',
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.query),
}));

function renderForm(locale: 'uk' | 'en' = 'en') {
  return render(
    <Providers>
      <I18nTestProvider locale={locale}>
        <ResetPasswordForm />
      </I18nTestProvider>
    </Providers>,
  );
}

function stubApi(response: () => Response) {
  const fetchMock = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const invalidLink = () =>
  new Response(
    JSON.stringify({ code: 'RESET_TOKEN_INVALID', message: 'bad link' }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  );

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirm: string,
) {
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Save password →' }));
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    nav.query = '?token=' + 't'.repeat(43);
    nav.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.getState().clearSession();
  });

  it('sends the token and new password, then goes to login with a notice', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(() => new Response(null, { status: 204 }));
    renderForm();

    await fill(user, 'brand-new-pass', 'brand-new-pass');

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/login?reset=1'),
    );
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/auth\/password\/reset$/);
    expect(JSON.parse(String(init.body))).toEqual({
      token: 't'.repeat(43),
      password: 'brand-new-pass',
      locale: 'en',
    });
  });

  it('does not call the API when the passwords differ', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(() => new Response(null, { status: 204 }));
    renderForm();

    await fill(user, 'brand-new-pass', 'something-else');

    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('asks for at least 8 characters', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(() => new Response(null, { status: 204 }));
    renderForm();

    await fill(user, 'short', 'short');

    expect(
      await screen.findByText('Password must contain at least 8 characters.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers a new link when the server rejects the token', async () => {
    const user = userEvent.setup();
    stubApi(invalidLink);
    renderForm();

    await fill(user, 'brand-new-pass', 'brand-new-pass');

    expect(
      await screen.findByText('This link is invalid or has expired.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Request a new link' }),
    ).toHaveAttribute('href', '/forgot-password');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('shows the invalid-link state without a token and never calls the API', () => {
    nav.query = '';
    const fetchMock = stubApi(() => new Response(null, { status: 204 }));
    renderForm('uk');

    expect(
      screen.getByText('Посилання недійсне або застаріло.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Запросити нове посилання' }),
    ).toHaveAttribute('href', '/forgot-password');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forgets the local session after a successful reset', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setAccessToken('stale-token');
    stubApi(() => new Response(null, { status: 204 }));
    renderForm();

    await fill(user, 'brand-new-pass', 'brand-new-pass');

    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(document.cookie).not.toContain('ys_web_session=complete');
  });
});
