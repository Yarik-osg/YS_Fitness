import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { useAuthStore } from '@/lib/stores/auth-store';
import { OnboardingWizard } from './onboarding-wizard';
import { useOnboardingStore } from './onboarding-store';

const push = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/onboarding',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe('OnboardingWizard', () => {
  beforeEach(() => {
    cleanup();
    window.sessionStorage.clear();
    useOnboardingStore.getState().reset();
    useAuthStore.getState().clearSession();
    push.mockReset();
  });

  it('preserves a selected answer after forward and back navigation', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Для жінок/i }));
    expect(
      screen.getByRole('button', { name: /Змінити мову/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Продовжити/i }));
    await user.click(screen.getByRole('button', { name: /Варіант 2/i }));
    await user.click(screen.getByRole('button', { name: /Обрати цю форму/i }));
    await user.click(screen.getByRole('button', { name: /Назад/i }));

    expect(screen.getByRole('button', { name: /Варіант 2/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(useOnboardingStore.getState().currentBody).toBe('toned');
  });

  it('sets program track and BMR calculation sex from a female direction choice', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Для жінок/i }));

    expect(useOnboardingStore.getState()).toMatchObject({
      programTrack: 'female',
      biologicalSexForCalculation: 'FEMALE',
    });
  });

  it('sets program track and BMR calculation sex from a male direction choice', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Для чоловіків/i }));

    expect(useOnboardingStore.getState()).toMatchObject({
      programTrack: 'male',
      biologicalSexForCalculation: 'MALE',
    });
    expect(screen.getByRole('button', { name: /Продовжити/i })).toHaveClass(
      'bg-[#c8ff2e]',
    );
  });

  it('continues from program track to current-body instead of the removed BMR step', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Для жінок/i }));
    await user.click(screen.getByRole('button', { name: /Продовжити/i }));

    expect(
      screen.queryByText(/Обери параметр для формули BMR/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Choose a parameter for the BMR formula/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Яка твоя/i)).toBeInTheDocument();
    expect(screen.getByText(/форма зараз/i)).toBeInTheDocument();
  });

  it('uses the reference option sets for the male track', () => {
    useOnboardingStore.setState({ programTrack: 'male', step: 9 });
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    expect(
      screen.getByRole('button', { name: /4–5 разів/i }),
    ).toBeInTheDocument();

    act(() => useOnboardingStore.getState().setStep(10));

    expect(
      screen.getByRole('button', { name: /Їм пізно ввечері або вночі/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Які звички/i)).toBeInTheDocument();
  });

  it('uses lime chrome for the male track and teal for female', () => {
    useOnboardingStore.setState({
      programTrack: 'male',
      currentBody: '0',
      step: 1,
    });
    const { container, unmount } = render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    const maleRoot = container.querySelector('.track-male');
    expect(maleRoot).toBeInTheDocument();
    expect(maleRoot).toHaveClass('track-male');
    unmount();

    useOnboardingStore.getState().reset();
    useOnboardingStore.setState({
      programTrack: 'female',
      currentBody: 'toned',
      step: 1,
    });
    const female = render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );
    expect(female.container.querySelector('.track-female')).toBeInTheDocument();
    expect(
      female.container.querySelector('.track-male'),
    ).not.toBeInTheDocument();
  });

  it('shows daily activity after training frequency', () => {
    useOnboardingStore.setState({
      programTrack: 'male',
      trainingFrequency: '3',
      step: 6,
    });
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    expect(screen.getByText(/активність протягом дня/i)).toBeInTheDocument();
    expect(screen.getByText(/Не враховуй тренування/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Середня/i }),
    ).toBeInTheDocument();
  });

  it('goes from desired body to main goal, matching the design-reference order', async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({
      programTrack: 'female',
      currentBody: 'toned',
      desiredBody: '1',
      step: 2,
    });
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Продовжити/i }));

    expect(screen.queryByText(/загальна статура/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Схуднути/i }),
    ).toBeInTheDocument();
  });

  it('lets a guest finish the quiz without creating an account first', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useOnboardingStore.setState({
      programTrack: 'female',
      currentBody: 'toned',
      desiredBody: '1',
      mainGoal: 'lose_weight',
      experience: 'beginner',
      trainingFrequency: '3',
      focusAreas: ['glutes'],
      nutritionCurrent: 'balanced',
      mealsPerDay: '3',
      eatingHabits: ['snacking'],
      dateOfBirth: '1994-05-10',
      heightCm: 168,
      weightKg: 64.5,
      step: 11,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Продовжити/i }));

    expect(
      screen.getByText(/Формуємо рекомендацію відповідно до твоєї мети/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sends a guest from Get Access to register', async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({
      programTrack: 'male',
      currentBody: '2',
      desiredBody: '4',
      mainGoal: 'build_muscle',
      experience: 'intermediate',
      trainingFrequency: '3',
      activityLevel: 'MODERATELY_ACTIVE',
      focusAreas: ['arms'],
      nutritionCurrent: 'high_protein',
      mealsPerDay: '4',
      eatingHabits: ['none'],
      dateOfBirth: '1990-01-15',
      heightCm: 180,
      weightKg: 82,
      step: 11,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Продовжити/i }));
    await user.click(
      await screen.findByRole(
        'button',
        { name: /Переглянути рекомендований план/i },
        { timeout: 4000 },
      ),
    );
    await user.click(screen.getByRole('button', { name: /Отримати доступ/i }));

    expect(push).toHaveBeenCalledWith({ pathname: '/register' });
  }, 10000);

  it('leaves the last quiz step even when a leftover session cannot save the draft', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession('token', {
      id: 'user-1',
      email: 'client@example.com',
      role: 'CLIENT',
      onboardingCompletedAt: null,
    });
    useOnboardingStore.setState({
      programTrack: 'male',
      dateOfBirth: '2004-06-25',
      heightCm: 180,
      weightKg: 80,
      step: 11,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Продовжити/i }));

    expect(
      screen.getByText(/Формуємо рекомендацію відповідно до твоєї мети/i),
    ).toBeInTheDocument();
  });
});
