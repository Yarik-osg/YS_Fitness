'use client';

import type { MeResponse, UserRole } from '@repo/shared-types';
import { create } from 'zustand';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  onboardingCompletedAt: string | null;
}

type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  user: SessionUser | null;
  status: AuthStatus;
  setChecking: () => void;
  setSession: (accessToken: string, user: SessionUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUserFromMe: (user: MeResponse) => void;
  clearSession: () => void;
}

export function normalizeSessionUser(user: MeResponse): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.profile?.name ?? null,
    onboardingCompletedAt: user.profile?.onboardingCompletedAt ?? null,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'idle',
  setChecking: () => set({ status: 'checking' }),
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: 'authenticated' }),
  setAccessToken: (accessToken) =>
    set((state) => ({ ...state, accessToken, status: 'authenticated' })),
  setUserFromMe: (user) =>
    set({ user: normalizeSessionUser(user), status: 'authenticated' }),
  clearSession: () =>
    set({ accessToken: null, user: null, status: 'unauthenticated' }),
}));
