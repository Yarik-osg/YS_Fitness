import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { CheckoutPage } from './checkout-page';

const MONTHLY_PLAN = {
  id: '11111111-1111-4111-8111-111111111111',
  code: '1_MONTH',
  name: '1 month',
  priceAmount: 99_000,
  currency: 'UAH',
  intervalMonths: 1,
  isActive: true,
};

const PROGRESS_PLAN = {
  id: '22222222-2222-4222-8222-222222222222',
  code: '3_MONTHS',
  name: '3 months',
  priceAmount: 249_000,
  currency: 'UAH',
  intervalMonths: 3,
  isActive: true,
};

const FULL_ACCESS_PLAN = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: 'FULL_ACCESS',
  name: 'FULL ACCESS',
  priceAmount: 349_000,
  currency: 'UAH',
  intervalMonths: 3,
  isActive: true,
};

const FULL_ACCESS_SUBSCRIPTION = {
  id: 'sub-full',
  userId: 'user-1',
  planId: FULL_ACCESS_PLAN.id,
  status: 'ACTIVE',
  provider: 'MOCK',
  providerReference: 'mock_sub',
  currentPeriodEnd: '2026-12-24T00:00:00.000Z',
  grantedByUserId: null,
  createdAt: '2026-09-24T00:00:00.000Z',
  plan: FULL_ACCESS_PLAN,
};

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
  usePathname: () => '/checkout',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe('CheckoutPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/subscriptions/plans') && !init?.method) {
          return new Response(
            JSON.stringify([MONTHLY_PLAN, PROGRESS_PLAN, FULL_ACCESS_PLAN]),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        if (url.includes('/subscriptions/me') && !init?.method) {
          return new Response(JSON.stringify({ subscription: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/subscriptions/checkout')) {
          expect(JSON.parse(String(init?.body))).toEqual({
            planId: FULL_ACCESS_PLAN.id,
          });
          return new Response(
            JSON.stringify({
              subscription: FULL_ACCESS_SUBSCRIPTION,
              checkoutUrl: null,
            }),
            {
              status: 201,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('lets a new member choose a plan and confirm mocked card payment', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <CheckoutPage />
        </Providers>
      </I18nTestProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: /обери абонемент/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BASIC' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'PROGRESS' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'FULL ACCESS' }));
    await user.click(
      screen.getByRole('button', { name: /перейти до оплати/i }),
    );

    expect(
      screen.getByRole('heading', { name: /останній крок/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/•••• •••• •••• ••••/)).toBeInTheDocument();

    const pay = screen.getByRole('button', { name: /оплатити 3490/i });
    expect(pay).toBeDisabled();

    await user.click(
      screen.getByRole('button', {
        name: /погоджуюсь з умовами надання послуг/i,
      }),
    );
    expect(pay).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /додати картку/i }));
    await user.click(pay);

    await waitFor(() => {
      expect(screen.getByText(/ти в грі/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/FULL ACCESS/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /кабінет/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('shows a retry when the plan catalog cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    render(
      <I18nTestProvider>
        <Providers>
          <CheckoutPage />
        </Providers>
      </I18nTestProvider>,
    );

    expect(
      await screen.findByRole(
        'button',
        { name: /спробувати ще/i },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /обери абонемент/i }),
    ).not.toBeInTheDocument();
  });
});
