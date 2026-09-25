import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { ApiClientError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { persistGuestOnboardingIfReady, useRegister } from './use-auth';

const api = vi.hoisted(() => ({
  register: vi.fn(),
  getMe: vi.fn(),
  saveOnboarding: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  register: api.register,
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('@/lib/api/users', () => ({
  getMe: api.getMe,
  saveOnboarding: api.saveOnboarding,
}));

const completeDraft = {
  programTrack: 'female' as const,
  currentBody: '1',
  desiredBody: '1',
  physiqueLevel: '1',
  mainGoal: 'lose_weight',
  experience: 'beginner',
  trainingFrequency: '3',
  activityLevel: 'MODERATELY_ACTIVE' as const,
  focusAreas: ['glutes'],
  nutritionCurrent: 'balanced',
  mealsPerDay: '3',
  eatingHabits: ['snacking'],
  goal: 'LOSE_WEIGHT' as const,
  dateOfBirth: '1994-05-10',
  heightCm: 168,
  weightKg: 64.5,
  biologicalSexForCalculation: 'FEMALE' as const,
};

const me = {
  id: 'user-1',
  email: 'client@example.com',
  role: 'CLIENT',
  profile: null,
};

function RegisterProbe() {
  const register = useRegister();
  return (
    <button
      type="button"
      onClick={() => {
        void register.mutateAsync({
          email: 'client@example.com',
          password: 'strong-password',
        });
      }}
    >
      {register.data?.destination ?? 'register'}
    </button>
  );
}

describe('persistGuestOnboardingIfReady and useRegister', () => {
  beforeEach(() => {
    cleanup();
    window.sessionStorage.clear();
    useOnboardingStore.getState().reset();
    useAuthStore.getState().clearSession();
    api.register.mockReset();
    api.getMe.mockReset();
    api.saveOnboarding.mockReset();
  });

  it('reports an incomplete draft instead of saving', async () => {
    useOnboardingStore.setState({ programTrack: 'male', step: 3 });

    await expect(persistGuestOnboardingIfReady()).resolves.toEqual({
      kind: 'invalid',
      step: 1,
    });
    expect(useOnboardingStore.getState()).toMatchObject({
      step: 1,
      submitError: { code: 'ONBOARDING_INCOMPLETE' },
    });
    expect(api.saveOnboarding).not.toHaveBeenCalled();
  });

  it('sends register to onboarding with step 11 when the date of birth is rejected', async () => {
    useOnboardingStore.setState({
      ...completeDraft,
      dateOfBirth: '1890-01-01',
      step: 11,
    });
    api.register.mockResolvedValue({
      tokens: { accessToken: 'token' },
      user: { ...me, onboardingCompletedAt: null },
    });
    api.getMe.mockResolvedValue(me);
    api.saveOnboarding.mockRejectedValue(
      new ApiClientError(
        400,
        'INVALID_DATE_OF_BIRTH',
        'dateOfBirth must be a real date within the last 120 years',
      ),
    );

    render(
      <Providers>
        <RegisterProbe />
      </Providers>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'register' }));

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('/onboarding'),
    );
    expect(useOnboardingStore.getState()).toMatchObject({
      step: 11,
      submitError: { code: 'INVALID_DATE_OF_BIRTH', status: 400 },
    });
  });

  it('returns empty when the quiz was never started', async () => {
    await expect(persistGuestOnboardingIfReady()).resolves.toEqual({
      kind: 'empty',
    });
    expect(api.saveOnboarding).not.toHaveBeenCalled();
  });
});
