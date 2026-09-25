import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth-store';
import { readSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { AuthGate, GuestGate } from './auth-gates';

const navigation = vi.hoisted(() => ({
  pathname: '/dashboard',
  replace: vi.fn(),
}));
const api = vi.hoisted(() => ({
  refresh: vi.fn(),
  getMe: vi.fn(),
  persistGuestOnboardingIfReady: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => navigation.pathname,
}));
vi.mock('@/components/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/lib/api/auth', () => ({ refresh: api.refresh }));
vi.mock('@/lib/api/users', () => ({ getMe: api.getMe }));
vi.mock('@/lib/hooks/use-auth', () => ({
  persistGuestOnboardingIfReady: api.persistGuestOnboardingIfReady,
}));

function tokenExpiringIn(seconds: number) {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }),
  );
  return `header.${payload}.signature`;
}

const completedUser = {
  id: 'user-1',
  email: 'client@example.com',
  role: 'CLIENT' as const,
  onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
};

function meResponse(onboardingCompletedAt: string | null) {
  return {
    id: 'user-1',
    email: 'client@example.com',
    role: 'CLIENT',
    profile: onboardingCompletedAt ? { onboardingCompletedAt } : null,
  };
}

function renderGate() {
  return render(
    <AuthGate>
      <p>protected content</p>
    </AuthGate>,
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    cleanup();
    navigation.pathname = '/dashboard';
    navigation.replace.mockReset();
    api.refresh.mockReset();
    api.getMe.mockReset();
    api.persistGuestOnboardingIfReady.mockReset();
    useAuthStore.getState().clearSession();
    document.cookie = 'ys_web_session=; Path=/; Max-Age=0';
  });

  it('does not refresh on navigation while the access token is fresh', async () => {
    useAuthStore.getState().setSession(tokenExpiringIn(600), completedUser);
    api.getMe.mockResolvedValue(
      meResponse(completedUser.onboardingCompletedAt),
    );

    const view = renderGate();
    expect(await screen.findByText('protected content')).toBeInTheDocument();

    navigation.pathname = '/dashboard/settings';
    view.rerender(
      <AuthGate>
        <p>protected content</p>
      </AuthGate>,
    );
    expect(await screen.findByText('protected content')).toBeInTheDocument();

    expect(api.refresh).not.toHaveBeenCalled();
    expect(api.getMe).toHaveBeenCalled();
  });

  it('hides checkout while the path change is rechecked', async () => {
    useAuthStore.getState().setSession(tokenExpiringIn(600), completedUser);
    api.getMe.mockResolvedValue(
      meResponse(completedUser.onboardingCompletedAt),
    );

    const view = renderGate();
    expect(await screen.findByText('protected content')).toBeInTheDocument();

    navigation.pathname = '/checkout';
    view.rerender(
      <AuthGate>
        <p>protected content</p>
      </AuthGate>,
    );

    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('uses /users/me onboarding status when the store is stale', async () => {
    useAuthStore.getState().setSession(tokenExpiringIn(600), {
      ...completedUser,
      onboardingCompletedAt: null,
    });
    api.getMe.mockResolvedValue(
      meResponse(completedUser.onboardingCompletedAt),
    );

    renderGate();

    expect(await screen.findByText('protected content')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.onboardingCompletedAt).toBe(
      completedUser.onboardingCompletedAt,
    );
  });

  it('refreshes once when the token is about to expire', async () => {
    useAuthStore.getState().setSession(tokenExpiringIn(5), completedUser);
    api.refresh.mockResolvedValue({
      tokens: { accessToken: tokenExpiringIn(900) },
    });
    api.getMe.mockResolvedValue(
      meResponse(completedUser.onboardingCompletedAt),
    );

    renderGate();

    expect(await screen.findByText('protected content')).toBeInTheDocument();
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('clears the session hint and redirects to login once when /users/me fails after refresh', async () => {
    writeSessionHint('complete');
    api.refresh.mockResolvedValue({
      tokens: { accessToken: tokenExpiringIn(900) },
    });
    api.getMe.mockRejectedValue(new Error('users/me failed'));

    renderGate();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('/login?next=%2Fdashboard');
    expect(readSessionHint()).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('sends checkout back to onboarding when the profile cannot be saved', async () => {
    navigation.pathname = '/checkout';
    useAuthStore.getState().setSession(tokenExpiringIn(600), {
      ...completedUser,
      onboardingCompletedAt: null,
    });
    api.getMe.mockResolvedValue(meResponse(null));
    api.persistGuestOnboardingIfReady.mockResolvedValue({
      kind: 'failed',
      step: 11,
      error: new Error('INVALID_DATE_OF_BIRTH'),
    });

    renderGate();

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/onboarding'),
    );
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('opens checkout once the guest profile is saved', async () => {
    navigation.pathname = '/checkout';
    useAuthStore.getState().setSession(tokenExpiringIn(600), {
      ...completedUser,
      onboardingCompletedAt: null,
    });
    api.getMe.mockResolvedValue(meResponse(null));
    api.persistGuestOnboardingIfReady.mockResolvedValue({
      kind: 'saved',
      user: meResponse(completedUser.onboardingCompletedAt),
    });

    renderGate();

    expect(await screen.findByText('protected content')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

function renderGuestGate() {
  return render(
    <GuestGate>
      <p>guest content</p>
    </GuestGate>,
  );
}

describe('GuestGate', () => {
  beforeEach(() => {
    cleanup();
    navigation.pathname = '/register';
    navigation.replace.mockReset();
    api.refresh.mockReset();
    api.getMe.mockReset();
    api.persistGuestOnboardingIfReady.mockReset();
    useAuthStore.getState().clearSession();
    useOnboardingStore.getState().reset();
    document.cookie = 'ys_web_session=; Path=/; Max-Age=0';
  });

  it('sends a logged-in incomplete user from register to onboarding when persist fails', async () => {
    useAuthStore.getState().setSession(tokenExpiringIn(600), {
      ...completedUser,
      onboardingCompletedAt: null,
    });
    api.getMe.mockResolvedValue(meResponse(null));
    api.persistGuestOnboardingIfReady.mockImplementation(async () => {
      useOnboardingStore.setState({
        step: 11,
        submitError: { code: 'INVALID_DATE_OF_BIRTH' },
      });
      return {
        kind: 'failed',
        step: 11,
        error: new Error('INVALID_DATE_OF_BIRTH'),
      };
    });

    renderGuestGate();

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/onboarding'),
    );
    expect(screen.queryByText('guest content')).not.toBeInTheDocument();
    expect(useOnboardingStore.getState()).toMatchObject({
      step: 11,
      submitError: { code: 'INVALID_DATE_OF_BIRTH' },
    });
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('lets a visitor without a session see the register form', async () => {
    api.refresh.mockRejectedValue(new Error('no session'));

    renderGuestGate();

    expect(await screen.findByText('guest content')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
