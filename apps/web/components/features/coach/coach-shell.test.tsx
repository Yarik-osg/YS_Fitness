import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachGate } from '@/components/auth/auth-gates';
import { Providers } from '@/components/providers';
import { ApiClientError } from '@/lib/api/client';
import { readSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { useAuthStore } from '@/lib/stores/auth-store';
import { I18nTestProvider } from '@/test/i18n';
import { CoachShell } from './coach-shell';

const navigation = vi.hoisted(() => ({
  pathname: '/coach',
  replace: vi.fn(),
}));
const api = vi.hoisted(() => ({
  logout: vi.fn(),
  refresh: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
    'aria-current'?: 'page';
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/auth', () => ({
  logout: api.logout,
  refresh: api.refresh,
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@/lib/api/users', () => ({
  getMe: api.getMe,
  saveOnboarding: vi.fn(),
}));

function tokenExpiringIn(seconds: number) {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }),
  );
  return `header.${payload}.signature`;
}

const trainer = {
  id: 'trainer-1',
  email: 'trainer@example.com',
  role: 'TRAINER' as const,
  name: 'Coach',
  onboardingCompletedAt: null,
};

function renderShell(children: ReactNode = <p>roster</p>) {
  return render(
    <Providers>
      <I18nTestProvider locale="en">
        <CoachShell>{children}</CoachShell>
      </I18nTestProvider>
    </Providers>,
  );
}

describe('CoachShell', () => {
  beforeEach(() => {
    cleanup();
    navigation.pathname = '/coach';
    navigation.replace.mockReset();
    api.logout.mockReset();
    api.refresh.mockReset();
    api.getMe.mockReset();
    useAuthStore.getState().clearSession();
    document.cookie = 'ys_web_session=; Path=/; Max-Age=0';
  });

  it('signs out through the existing logout flow', async () => {
    writeSessionHint('coach');
    useAuthStore.getState().setSession('token', trainer);
    api.logout.mockResolvedValue(undefined);

    renderShell();
    expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', { name: 'Change language' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('/login');
    expect(readSessionHint()).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('does not mark Clients as the current page on a client file', () => {
    navigation.pathname = '/coach/clients/client-1';
    renderShell();
    expect(screen.getByRole('link', { name: 'Clients' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps the coach page when logout fails after the local session is cleared', async () => {
    writeSessionHint('coach');
    useAuthStore.getState().setSession(tokenExpiringIn(600), trainer);
    api.getMe.mockResolvedValue({
      id: trainer.id,
      email: trainer.email,
      role: 'TRAINER',
      profile: null,
    });
    api.logout.mockRejectedValue(
      new ApiClientError(500, 'SERVER_ERROR', 'down'),
    );

    render(
      <Providers>
        <I18nTestProvider locale="en">
          <CoachGate>
            <CoachShell>
              <p>roster</p>
            </CoachShell>
          </CoachGate>
        </I18nTestProvider>
      </Providers>,
    );

    expect(await screen.findByText('roster')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side. Please try again.',
    );
    expect(screen.getByText('roster')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(api.refresh).not.toHaveBeenCalled();
    expect(readSessionHint()).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
