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
    expect(screen.getAllByRole('button', { name: /Варіант/ })).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: /Варіант 2/i }));
    await user.click(screen.getByRole('button', { name: /Обрати цю форму/i }));
    expect(screen.getAllByRole('button', { name: /Варіант/ })).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: /Назад/i }));

    expect(screen.getByRole('button', { name: /Варіант 2/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(useOnboardingStore.getState().currentBody).toBe('1');
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

  it('keeps a single training focus when another area is chosen', async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({ programTrack: 'male', step: 7 });
    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Плечі' }));
    await user.click(screen.getByRole('button', { name: 'Спина' }));

    expect(useOnboardingStore.getState().focusAreas).toEqual(['back']);
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
      currentBody: '1',
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
      currentBody: '1',
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
      currentBody: '1',
      desiredBody: '1',
      mainGoal: 'lose_weight',
      experience: 'beginner',
      trainingFrequency: '3',
      focusAreas: ['glutes'],
      nutritionCurrent: 'balanced',
      mealsPerDay: '3',
      eatingHabits: ['snacking'],
      dateOfBirth: '1994-05-10',
      name: 'Олена',
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

    await user.click(
      screen.getByRole('button', { name: /Побудувати мій план/i }),
    );

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
      desiredBody: '3',
      mainGoal: 'build_muscle',
      experience: 'intermediate',
      trainingFrequency: '3',
      activityLevel: 'MODERATELY_ACTIVE',
      focusAreas: ['arms'],
      nutritionCurrent: 'high_protein',
      mealsPerDay: '4',
      eatingHabits: ['none'],
      dateOfBirth: '1990-01-15',
      name: 'Andrii',
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

    expect(screen.getByLabelText(/Дата народження/i)).not.toHaveClass(
      'appearance-none',
    );
    expect(screen.getByRole('spinbutton', { name: 'Зріст' })).toHaveClass(
      'appearance-none',
    );

    await user.click(
      screen.getByRole('button', { name: /Побудувати мій план/i }),
    );
    const access = await screen.findByRole(
      'button',
      { name: /Отримати доступ/i },
      { timeout: 4000 },
    );

    expect(screen.getByText('Основна мета')).toBeInTheDocument();
    expect(screen.getByText("Набрати м'язову масу")).toBeInTheDocument();
    expect(screen.getByText('Рівень')).toBeInTheDocument();
    expect(screen.getByText('Середній рівень')).toBeInTheDocument();
    expect(screen.getByText('Частота')).toBeInTheDocument();
    expect(screen.getByText('3×/тиждень')).toBeInTheDocument();
    expect(screen.getByText('Акцент')).toBeInTheDocument();
    expect(screen.getByText('Руки')).toBeInTheDocument();
    expect(screen.queryByText('2 990')).not.toBeInTheDocument();
    expect(screen.queryByText('Вартість')).not.toBeInTheDocument();

    await user.click(access);

    expect(push).toHaveBeenCalledWith({ pathname: '/register' });
  }, 10000);

  it('sends a signed-in user to the first invalid step instead of treating an unsavable draft as done', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.getState().setSession('token', {
      id: 'user-1',
      email: 'client@example.com',
      role: 'CLIENT',
      name: null,
      onboardingCompletedAt: null,
    });
    useOnboardingStore.setState({
      programTrack: 'male',
      dateOfBirth: '2004-06-25',
      name: 'Andrii',
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

    await user.click(
      screen.getByRole('button', { name: /Побудувати мій план/i }),
    );

    expect(
      screen.queryByText(/Формуємо рекомендацію відповідно до твоєї мети/i),
    ).not.toBeInTheDocument();
    expect(useOnboardingStore.getState().step).toBe(1);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Деякі відповіді потрібно оновити/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('clears answers that belong to the previous track when the track changes', async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({
      programTrack: 'male',
      currentBody: '4',
      physiqueLevel: '4',
      desiredBody: '2',
      focusAreas: ['chest'],
      mealsPerDay: '4-5',
      eatingHabits: ['late_eating'],
      step: 0,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Для жінок/i }));

    const state = useOnboardingStore.getState();
    expect(state.programTrack).toBe('female');
    expect(state.currentBody).toBeUndefined();
    expect(state.physiqueLevel).toBeUndefined();
    expect(state.focusAreas).toEqual([]);
    expect(state.mealsPerDay).toBeUndefined();
    expect(state.eatingHabits).toEqual([]);
    expect(state.desiredBody).toBe('2');
  });

  it('keeps answers when the same track is chosen again', async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({
      programTrack: 'female',
      focusAreas: ['glutes'],
      mealsPerDay: '3',
      step: 0,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Для жінок/i }));

    expect(useOnboardingStore.getState().focusAreas).toEqual(['glutes']);
    expect(useOnboardingStore.getState().mealsPerDay).toBe('3');
  });

  it('keeps step 11 blocked for a future date or a date older than 120 years', () => {
    useOnboardingStore.setState({
      programTrack: 'female',
      dateOfBirth: '1890-01-01',
      name: 'Олена',
      heightCm: 168,
      weightKg: 64,
      step: 11,
    });

    const view = render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Побудувати мій план/i }),
    ).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /реальну дату народження/i,
    );

    act(() =>
      useOnboardingStore.getState().setAnswer({ dateOfBirth: '2099-01-01' }),
    );
    expect(
      screen.getByRole('button', { name: /Побудувати мій план/i }),
    ).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /реальну дату народження/i,
    );

    act(() =>
      useOnboardingStore.getState().setAnswer({ dateOfBirth: '1994-05-10' }),
    );
    expect(
      screen.getByRole('button', { name: /Побудувати мій план/i }),
    ).toBeEnabled();
    view.unmount();
  });

  it('blocks step 11 for a name with digits or a height below 80 cm', () => {
    useOnboardingStore.setState({
      programTrack: 'female',
      dateOfBirth: '1994-05-10',
      name: 'Anna2',
      heightCm: 20,
      weightKg: 64,
      step: 11,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Побудувати мій план/i }),
    ).toBeDisabled();
    expect(screen.getByText(/лише літери/i)).toBeInTheDocument();
    expect(
      screen.getByText(/зріст має бути від 80 до 250 см/i),
    ).toBeInTheDocument();
  });

  it('opens height and weight on the average values', () => {
    useOnboardingStore.setState({
      programTrack: 'female',
      step: 11,
      heightCm: undefined,
      weightKg: undefined,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    expect(screen.getByRole('spinbutton', { name: 'Зріст' })).toHaveValue(170);
    expect(screen.getByRole('spinbutton', { name: 'Вага' })).toHaveValue(60);
  });

  it('uses height arrows to move an out-of-range value onto the allowed minimum', async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({
      programTrack: 'female',
      dateOfBirth: '1994-05-10',
      name: 'Олена',
      heightCm: 20,
      weightKg: 64,
      step: 11,
    });

    render(
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /збільшити зріст/i }));

    expect(useOnboardingStore.getState().heightCm).toBe(80);
    expect(
      screen.queryByText(/зріст має бути від 80 до 250 см/i),
    ).not.toBeInTheDocument();
  });
});
