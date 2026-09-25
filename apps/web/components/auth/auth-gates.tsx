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
import {
  getPostAuthPath,
  getPostRegisterPath,
  resolveIncompleteGuestDestination,
} from '@/lib/auth/routing';
import { writeSessionHint } from '@/lib/auth/session-cookie';
import { normalizeSessionUser, useAuthStore } from '@/lib/stores/auth-store';

async function restoreSession(options: { claimGuest?: boolean } = {}) {
  const response = await refresh();
  const user = await getMe();
  useAuthStore
    .getState()
    .setSession(response.tokens.accessToken, normalizeSessionUser(user));
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function validate() {
      useAuthStore.getState().setChecking();
      try {
        const restoredUser = await restoreSession({ claimGuest: true });
        if (!active) return;
        if (
          pathname.startsWith('/checkout') &&
          !restoredUser.profile?.onboardingCompletedAt
        ) {
          try {
            await persistGuestOnboardingIfReady();
          } catch {
            // Stay on checkout so registration is not sent back through the quiz.
          }
          if (active) setReady(true);
          return;
        }
        const destination = getPostAuthPath(restoredUser);
        if (
          pathname.startsWith('/dashboard') &&
          destination.startsWith('/onboarding')
        ) {
          router.replace(destination);
          return;
        }
        setReady(true);
      } catch {
        if (!active) return;
        useAuthStore.getState().clearSession();
        if (!pathname.startsWith('/checkout')) {
          resetOnboardingDraft();
        }
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    }

    void validate();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  return ready ? children : <LoadingScreen />;
}

export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    restoreSession({ claimGuest: true })
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
        let saved = false;
        try {
          saved = Boolean(await persistGuestOnboardingIfReady());
        } catch {
          // Leave the register form in place when the quiz cannot be saved.
        }
        if (pathname.startsWith('/register') && saved) {
          router.replace(getPostRegisterPath());
          return;
        }
        if (pathname.startsWith('/register')) {
          if (active) setReady(true);
          return;
        }
        const destination = resolveIncompleteGuestDestination(pathname);
        if (destination) {
          router.replace(destination);
          return;
        }
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  return ready ? children : <LoadingScreen />;
}
