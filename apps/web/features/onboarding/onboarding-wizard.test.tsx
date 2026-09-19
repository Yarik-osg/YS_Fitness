import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { OnboardingWizard } from './onboarding-wizard';
import { useOnboardingStore } from './onboarding-store';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

describe('OnboardingWizard', () => {
  beforeEach(() => {
    cleanup();
    window.sessionStorage.clear();
    useOnboardingStore.getState().reset();
    push.mockReset();
  });

  it('preserves a selected answer after forward and back navigation', async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <OnboardingWizard />
      </Providers>,
    );

    await user.click(screen.getByRole('button', { name: /Для жінок/i }));
    await user.click(screen.getByRole('button', { name: /Продовжити/i }));
    await user.click(screen.getByRole('button', { name: /Варіант 2/i }));
    await user.click(screen.getByRole('button', { name: /Продовжити/i }));
    await user.click(screen.getByRole('button', { name: /Назад/i }));

    expect(screen.getByRole('button', { name: /Варіант 2/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(useOnboardingStore.getState().currentBody).toBe('toned');
  });

  it('uses the reference option sets for the male track', () => {
    useOnboardingStore.setState({ programTrack: 'male', step: 10 });
    render(
      <Providers>
        <OnboardingWizard />
      </Providers>,
    );

    expect(
      screen.getByRole('button', { name: /4–5 разів/i }),
    ).toBeInTheDocument();

    act(() => useOnboardingStore.getState().setStep(11));

    expect(
      screen.getByRole('button', { name: /Їм пізно ввечері або вночі/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Які звички/i)).toBeInTheDocument();
  });
});
