import { act, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { OnboardingWizard } from './onboarding-wizard';
import { useOnboardingStore } from './onboarding-store';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/onboarding',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function Page() {
  return (
    <I18nTestProvider>
      <Providers>
        <OnboardingWizard />
      </Providers>
    </I18nTestProvider>
  );
}

describe('OnboardingWizard hydration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.sessionStorage.clear();
    useOnboardingStore.getState().reset();
  });

  it('paints a neutral loader instead of step 0, then the saved step, with no hydration errors', async () => {
    const serverHtml = renderToString(<Page />);
    expect(serverHtml).toContain('aria-busy="true"');
    expect(serverHtml).not.toContain('Обери свій');

    window.sessionStorage.setItem(
      'ys-onboarding-draft',
      JSON.stringify({
        state: {
          programTrack: 'female',
          step: 7,
          focusAreas: [],
          eatingHabits: [],
        },
        version: 0,
      }),
    );
    await useOnboardingStore.persist.rehydrate();
    expect(useOnboardingStore.getState().step).toBe(7);

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const recoverableErrors: unknown[] = [];

    await act(async () => {
      hydrateRoot(container, <Page />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(
      await screen.findByRole('button', { name: 'Сідниці' }),
    ).toBeInTheDocument();
    expect(recoverableErrors).toEqual([]);
    expect(
      consoleError.mock.calls.filter((call) =>
        /hydrat/i.test(call.map(String).join(' ')),
      ),
    ).toEqual([]);
  });
});
