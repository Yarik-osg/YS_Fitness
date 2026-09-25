'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import {
  bindOnboardingDraftToUser,
  resetOnboardingDraft,
} from '@/features/onboarding/onboarding-store';
import { usePathname, useRouter } from '@/i18n/navigation';
import { refresh } from '@/lib/api/auth';
import { getMe } from '@/lib/api/users';
import { persistGuestOnboardingIfReady } from '@/lib/hooks/use-auth';
import { isAccessTokenFresh } from '@/lib/auth/access-token';
import {
  getPostAuthPath,
  getPostRegisterPath,
  resolveIncompleteGuestDestination,
  type OnboardingStatusUser,
} from '@/lib/auth/routing';
import { clearSessionHint, writeSessionHint } from '@/lib/auth/session-cookie';
import { normalizeSessionUser, useAuthStore } from '@/lib/stores/auth-store';

function applyMe(
  accessToken: string,
  user: Awaited<ReturnType<typeof getMe>>,
  options: { claimGuest?: boolean } = {},
) {
  useAuthStore.getState().setSession(accessToken, normalizeSessionUser(user));
  writeSessionHint(
    user.profile?.onboardingCompletedAt ? 'complete' : 'onboarding',
  );
  if (user.profile?.onboardingCompletedAt) {
    resetOnboardingDraft();
  } else {
    bindOnboardingDraftToUser(user.id, { claimGuest: options.claimGuest });
  }
  return user;
}

async function currentSessionUser(): Promise<OnboardingStatusUser> {
  const { accessToken, user } = useAuthStore.getState();
  if (user && accessToken && isAccessTokenFresh(accessToken)) {
    return applyMe(accessToken, await getMe(), { claimGuest: true });
  }
  return restoreSession({ claimGuest: true });
}

async function restoreSession(options: { claimGuest?: boolean } = {}) {
  const response = await refresh();
  return applyMe(response.tokens.accessToken, await getMe(), options);
}

function LoadingScreen() {
  return (
    <main className="relative grid min-h-screen place-items-center px-6">
      <div className="absolute top-8 right-6">
        <LocaleSwitcher />
      </div>
      <div className="text-center">
        <p className="font-heading text-3xl uppercase tracking-wider">
          YS Fitness
        </p>
        <div className="mx-auto mt-5 h-0.5 w-24 animate-pulse bg-accent" />
      </div>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [readyPath, setReadyPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function validate() {
      let sessionUser: OnboardingStatusUser;
      try {
        sessionUser = await currentSessionUser();
      } catch {
        if (!active) return;
        useAuthStore.getState().clearSession();
        clearSessionHint();
        if (!pathname.startsWith('/checkout')) {
          resetOnboardingDraft();
        }
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!active) return;

      if (
        pathname.startsWith('/checkout') &&
        !sessionUser.profile?.onboardingCompletedAt
      ) {
        const saved = await persistGuestOnboardingIfReady().catch(() => null);
        if (!active) return;
        if (saved?.kind === 'saved') {
          setReadyPath(pathname);
        } else {
          router.replace('/onboarding');
        }
        return;
      }

      const destination = getPostAuthPath(sessionUser);
      if (
        pathname.startsWith('/dashboard') &&
        destination.startsWith('/onboarding')
      ) {
        router.replace(destination);
        return;
      }
      setReadyPath(pathname);
    }

    void validate();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  return readyPath === pathname ? children : <LoadingScreen />;
}

export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [readyPath, setReadyPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    currentSessionUser()
      .then(async (user) => {
        if (!active) return;
        if (user.profile?.onboardingCompletedAt) {
          router.replace(
            pathname.startsWith('/register')
              ? getPostRegisterPath()
              : getPostAuthPath(user),
          );
          return;
        }
        const saved = await persistGuestOnboardingIfReady().catch(() => null);
        if (!active) return;
        if (pathname.startsWith('/register')) {
          router.replace(
            saved?.kind === 'saved' ? getPostRegisterPath() : '/onboarding',
          );
          return;
        }
        const destination = resolveIncompleteGuestDestination(pathname);
        if (destination) {
          router.replace(destination);
          return;
        }
        if (active) setReadyPath(pathname);
      })
      .catch(() => {
        if (active) setReadyPath(pathname);
      });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  return readyPath === pathname ? children : <LoadingScreen />;
}
