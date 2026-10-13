import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { ForgotPasswordForm } from './forgot-password-form';

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
  usePathname: () => '/forgot-password',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function renderForm(locale: 'uk' | 'en' = 'uk') {
  return render(
    <Providers>
      <I18nTestProvider locale={locale}>
        <ForgotPasswordForm />
      </I18nTestProvider>
    </Providers>,
  );
}

function stubApi(response: () => Response) {
  const fetchMock = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof stubApi>) {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  return { url, body: JSON.parse(String(init.body)) as unknown };
}

describe('ForgotPasswordForm', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends the email with the page language and shows the same neutral message', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(() => new Response(null, { status: 204 }));
    renderForm('en');

    await user.type(screen.getByLabelText('Email'), 'olena@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link →' }));

    expect(
      await screen.findByText(
        'If an account exists for this email, we sent a link. It is valid for 30 minutes.',
      ),
    ).toBeInTheDocument();
    const { url, body } = sentBody(fetchMock);
    expect(url).toMatch(/\/auth\/password\/forgot$/);
    expect(body).toEqual({ email: 'olena@example.com', locale: 'en' });
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('speaks Ukrainian by default', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(() => new Response(null, { status: 204 }));
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'olena@example.com');
    await user.click(
      screen.getByRole('button', { name: 'Надіслати посилання →' }),
    );

    expect(
      await screen.findByText(/Якщо акаунт з таким email існує/),
    ).toBeInTheDocument();
    expect(sentBody(fetchMock).body).toMatchObject({ locale: 'uk' });
  });

  it('rejects an invalid email before calling the API', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(() => new Response(null, { status: 204 }));
    renderForm('en');

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send reset link →' }));

    expect(await screen.findByText('Enter a valid email.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the form and explains a rate limit', async () => {
    const user = userEvent.setup();
    stubApi(
      () =>
        new Response(
          JSON.stringify({ code: 'TOO_MANY_REQUESTS', message: 'slow down' }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
    );
    renderForm('en');

    await user.type(screen.getByLabelText('Email'), 'olena@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link →' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Wait a moment and try again.',
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
