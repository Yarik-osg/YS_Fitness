import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
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
      <I18nTestProvider>
        <Providers>
          <OnboardingWizard />
        </Providers>
      </I18nTestProvider>,
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
