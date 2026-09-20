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
    expect(heroCta).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /Увійти/i })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      screen.getByRole('button', { name: /Змінити мову/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Обрати 3 місяці/i }),
      ).toBeEnabled();
    });
  });

  it('enables plan buttons from catalog prices and sends guests to register', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <LandingPage />
        </Providers>
      </I18nTestProvider>,
    );

    const threeMonths = await screen.findByRole('button', {
      name: /Обрати 3 місяці/i,
    });
    const oneMonth = await screen.findByRole('button', {
      name: /Обрати 1 місяць/i,
    });

    expect(threeMonths).toBeEnabled();
    expect(oneMonth).toBeEnabled();
    expect(screen.getByText('2490')).toBeInTheDocument();
    expect(screen.getByText('990')).toBeInTheDocument();

    await user.click(threeMonths);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/register?planId=plan-3');
    });
    expect(window.sessionStorage.getItem('ys_selected_plan_id')).toBe('plan-3');
  });
});

describe('persistSelectedPlanId', () => {
  it('stores the selected plan id', () => {
    window.sessionStorage.clear();
    persistSelectedPlanId('plan-1');
    expect(window.sessionStorage.getItem('ys_selected_plan_id')).toBe('plan-1');
  });
});
