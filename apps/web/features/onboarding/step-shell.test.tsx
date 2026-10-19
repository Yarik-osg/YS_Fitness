import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { StepShell } from './step-shell';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/onboarding',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function Harness() {
  const [step, setStep] = useState(0);
  return (
    <StepShell
      step={step}
      total={3}
      title={`Title ${step}`}
      canContinue
      onBack={() => setStep((value) => Math.max(0, value - 1))}
      onContinue={() => setStep((value) => value + 1)}
    >
      <p>Content {step}</p>
    </StepShell>
  );
}

function renderHarness() {
  return render(
    <I18nTestProvider>
      <Providers>
        <Harness />
      </Providers>
    </I18nTestProvider>,
  );
}

describe('StepShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the first step without an enter animation', () => {
    renderHarness();

    expect(screen.getByText('Content 0')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    const section = screen.getByText('Content 0').closest('section')!;
    // `initial={false}`: no starting offset or fade on first render.
    expect(section.style.opacity).not.toBe('0');
    expect(section.style.transform).toBe('none');
  });

  it('renders only the current step when going forward and back', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: /Продовжити/ }));
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 0')).not.toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Назад/ }));
    expect(screen.getByText('Content 0')).toBeInTheDocument();
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });
});
