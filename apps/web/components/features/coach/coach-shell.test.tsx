import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { readSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { useAuthStore } from '@/lib/stores/auth-store';
import { I18nTestProvider } from '@/test/i18n';
import { CoachShell } from './coach-shell';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
const logout = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/coach',
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/hooks/use-auth', () => ({
  useLogout: () => logout,
}));

function renderShell() {
  return render(
    <I18nTestProvider locale="en">
      <CoachShell>
        <p>roster</p>
      </CoachShell>
    </I18nTestProvider>,
  );
}

describe('CoachShell', () => {
  beforeEach(() => {
    cleanup();
    navigation.replace.mockReset();
    logout.mutateAsync.mockReset();
    logout.isPending = false;
    useAuthStore.getState().clearSession();
    document.cookie = 'ys_web_session=; Path=/; Max-Age=0';
  });

  it('signs out through the existing logout flow', async () => {
    writeSessionHint('coach');
    useAuthStore.getState().setSession('token', {
      id: 'trainer-1',
      email: 'trainer@example.com',
      role: 'TRAINER',
      name: 'Coach',
      onboardingCompletedAt: null,
    });
    logout.mutateAsync.mockImplementation(async () => {
      useAuthStore.getState().clearSession();
      document.cookie = 'ys_web_session=; Path=/; Max-Age=0';
    });

    renderShell();
    expect(
      screen.getByRole('button', { name: 'Change language' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(logout.mutateAsync).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('/login');
    expect(readSessionHint()).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('shows an error and stays when logout fails', async () => {
    logout.mutateAsync.mockRejectedValue(
      new ApiClientError(500, 'SERVER_ERROR', 'down'),
    );

    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong on our side. Please try again.',
    );
  });
});
