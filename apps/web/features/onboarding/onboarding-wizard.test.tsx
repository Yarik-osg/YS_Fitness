import { render, screen } from '@testing-library/react';
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
    expect(useOnboardingStore.getState().currentBody).toBe('1');
  });
});
