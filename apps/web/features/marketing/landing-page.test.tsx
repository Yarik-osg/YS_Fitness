import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { persistSelectedPlanId } from '@/lib/subscriptions/selected-plan';
import { LandingPage } from './landing-page';

const push = vi.fn();

const PLANS = [
  {
    id: 'plan-3',
    code: '3_MONTHS',
    name: '3 months',
    priceAmount: 249_000,
    currency: 'UAH',
    intervalMonths: 3,
    isActive: true,
  },
  {
    id: 'plan-1',
    code: '1_MONTH',
    name: '1 month',
    priceAmount: 99_000,
    currency: 'UAH',
    intervalMonths: 1,
    isActive: true,
  },
  {
    id: 'plan-full',
    code: 'FULL_ACCESS',
    name: 'FULL ACCESS',
    priceAmount: 349_000,
    currency: 'UAH',
    intervalMonths: 3,
    isActive: true,
  },
];

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe('LandingPage', () => {
  beforeEach(() => {
    push.mockReset();
    window.sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/plans')) {
          return new Response(JSON.stringify(PLANS), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(null, { status: 401 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends the hero CTA to registration', async () => {
    render(
      <I18nTestProvider>
        <Providers>
          <LandingPage />
        </Providers>
      </I18nTestProvider>,
    );

    const heroCta = screen.getAllByRole('link', { name: /Почати зміни/i })[0];
    expect(heroCta).toHaveAttribute('href', '/onboarding');
    expect(screen.getByRole('link', { name: /Увійти/i })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      screen.getByRole('button', { name: /Змінити мову/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Обрати PROGRESS/i }),
      ).toBeEnabled();
    });
  });

  it('enables plan buttons from catalog prices and sends guests to onboarding', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <LandingPage />
        </Providers>
      </I18nTestProvider>,
    );

    const progress = await screen.findByRole('button', {
      name: /Обрати PROGRESS/i,
    });
    const basic = await screen.findByRole('button', {
      name: /Обрати BASIC/i,
    });
    const fullAccess = await screen.findByRole('button', {
      name: /Обрати FULL ACCESS/i,
    });

    expect(progress).toBeEnabled();
    expect(basic).toBeEnabled();
    expect(fullAccess).toBeEnabled();
    expect(screen.getByText('2490')).toBeInTheDocument();
    expect(screen.getByText('990')).toBeInTheDocument();
    expect(screen.getByText('3490')).toBeInTheDocument();
    expect(screen.getByText('Найпопулярніший')).toBeInTheDocument();
    expect(screen.getAllByText('Найпопулярніший')).toHaveLength(1);
    expect(screen.queryByText('Все з PROGRESS')).not.toBeInTheDocument();

    const includesToggles = screen.getAllByRole('button', {
      name: /Що входить/i,
    });
    const progressIncludes = includesToggles[1];
    const fullIncludes = includesToggles[2];
    if (!progressIncludes || !fullIncludes) {
      throw new Error('expected three includes toggles');
    }
    await user.click(progressIncludes);
    expect(screen.getByText('Все з BASIC')).toBeInTheDocument();
    expect(screen.queryByText('Все з PROGRESS')).not.toBeInTheDocument();
    await user.click(fullIncludes);
    expect(screen.getByText('Все з PROGRESS')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Згорнути/i }),
    ).toBeInTheDocument();

    await user.click(progress);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/onboarding');
    });
    expect(window.sessionStorage.getItem('ys_selected_plan_id')).toBe('plan-3');
  });

  it('sends FULL ACCESS guests to onboarding and keeps that plan id', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <LandingPage />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(
      await screen.findByRole('button', { name: /Обрати FULL ACCESS/i }),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/onboarding');
    });
    expect(window.sessionStorage.getItem('ys_selected_plan_id')).toBe(
      'plan-full',
    );
  });

  it('sends a completed session to the dashboard instead of login', () => {
    render(
      <I18nTestProvider>
        <Providers>
          <LandingPage sessionHint="complete" />
        </Providers>
      </I18nTestProvider>,
    );

    expect(screen.getByRole('link', { name: /Кабінет/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(
      screen.queryByRole('link', { name: /Увійти/i }),
    ).not.toBeInTheDocument();
  });

  it('sends an in-progress session back to onboarding', () => {
    render(
      <I18nTestProvider>
        <Providers>
          <LandingPage sessionHint="onboarding" />
        </Providers>
      </I18nTestProvider>,
    );

    expect(screen.getByRole('link', { name: /Продовжити/i })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });
});

describe('persistSelectedPlanId', () => {
  it('stores the selected plan id', () => {
    window.sessionStorage.clear();
    persistSelectedPlanId('plan-1');
    expect(window.sessionStorage.getItem('ys_selected_plan_id')).toBe('plan-1');
  });
});
