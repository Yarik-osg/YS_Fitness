'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getPostAuthPath } from '@/lib/auth/routing';
import { writeSessionHint } from '@/lib/auth/session-cookie';
import { refresh } from '@/lib/api/auth';
import { getMe } from '@/lib/api/users';
import { usePathname, useRouter } from '@/i18n/navigation';
import { normalizeSessionUser, useAuthStore } from '@/lib/stores/auth-store';

async function restoreSession() {
  const response = await refresh();
  const user = await getMe();
  useAuthStore
    .getState()
    .setSession(response.tokens.accessToken, normalizeSessionUser(user));
  writeSessionHint(
    user.profile?.onboardingCompletedAt ? 'complete' : 'onboarding',
  );
  return user;
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
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
        const restoredUser = await restoreSession();
        if (!active) return;
        const destination = getPostAuthPath(restoredUser);
        if (
          (pathname.startsWith('/dashboard') &&
            destination === '/onboarding') ||
          (pathname.startsWith('/onboarding') && destination === '/dashboard')
        ) {
          router.replace(destination);
          return;
        }
        setReady(true);
      } catch {
        if (!active) return;
        useAuthStore.getState().clearSession();
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((user) => {
        if (active) router.replace(getPostAuthPath(user));
      })
      .catch(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [router]);

  return ready ? children : <LoadingScreen />;
}
