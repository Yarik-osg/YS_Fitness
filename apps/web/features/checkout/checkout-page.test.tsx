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

const routerPush = vi.hoisted(() => vi.fn());

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
  useRouter: () => ({ replace: routerPush, push: routerPush }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe('CheckoutPage', () => {
  beforeEach(() => {
    routerPush.mockClear();
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
        if (url.includes('/programs/me') && !init?.method) {
          return new Response(JSON.stringify({ program: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/programs/assign') && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'program-1' }), {
            status: 201,
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
    expect(screen.getByText('Твоя програма')).toBeInTheDocument();
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

    expect(await screen.findByText(/ти в грі/i)).toBeInTheDocument();
    expect(
      screen.getByText(/вже доступна в особистому кабінеті/i),
    ).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: /перейти до програми/i }),
    );
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith('/dashboard');
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/programs/assign'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not assign when the current program cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/subscriptions/plans') && !init?.method) {
          return new Response(JSON.stringify([FULL_ACCESS_PLAN]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/subscriptions/me') && !init?.method) {
          return new Response(JSON.stringify({ subscription: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/programs/me')) {
          return new Response(null, { status: 500 });
        }
        if (url.includes('/subscriptions/checkout')) {
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

    render(
      <I18nTestProvider>
        <Providers>
          <CheckoutPage />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(
      await screen.findByRole('button', { name: /перейти до оплати/i }),
    );
    await user.click(
      screen.getByRole('button', {
        name: /погоджуюсь з умовами надання послуг/i,
      }),
    );
    await user.click(screen.getByRole('button', { name: /додати картку/i }));
    await user.click(screen.getByRole('button', { name: /оплатити/i }));
    await user.click(
      await screen.findByRole('button', { name: /перейти до програми/i }),
    );

    expect(
      await screen.findByText(
        'Щось пішло не так з нашого боку. Спробуй ще раз.',
      ),
    ).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/programs/assign'),
      expect.anything(),
    );
  });

  it('opens the cabinet without granting access when checkout is skipped', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider>
        <Providers>
          <CheckoutPage />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(
      await screen.findByRole('button', { name: /продовжити без абонемента/i }),
    );

    expect(routerPush).toHaveBeenCalledWith('/dashboard');
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/subscriptions/checkout'),
      expect.anything(),
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

  it('sends the member to the delayed-provider checkout url', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
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
          return new Response(
            JSON.stringify({
              subscription: {
                ...FULL_ACCESS_SUBSCRIPTION,
                status: 'PENDING',
              },
              checkoutUrl: 'https://pay.example/first',
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

    render(
      <I18nTestProvider>
        <Providers>
          <CheckoutPage />
        </Providers>
      </I18nTestProvider>,
    );

    await user.click(
      await screen.findByRole('button', { name: 'FULL ACCESS' }),
    );
    await user.click(
      screen.getByRole('button', { name: /перейти до оплати/i }),
    );
    await user.click(
      screen.getByRole('button', {
        name: /погоджуюсь з умовами надання послуг/i,
      }),
    );
    await user.click(screen.getByRole('button', { name: /додати картку/i }));
    await user.click(screen.getByRole('button', { name: /оплатити 3490/i }));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://pay.example/first');
    });
    expect(screen.queryByText(/ти в грі/i)).not.toBeInTheDocument();
  });

  it('does not treat an unpaid pending checkout as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/plans')) {
          return new Response(
            JSON.stringify([MONTHLY_PLAN, PROGRESS_PLAN, FULL_ACCESS_PLAN]),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        if (url.includes('/subscriptions/me')) {
          return new Response(
            JSON.stringify({
              subscription: {
                ...FULL_ACCESS_SUBSCRIPTION,
                status: 'PENDING',
              },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

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
    expect(screen.queryByText(/ти в грі/i)).not.toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it.each(['EXPIRED', 'CANCELED'] as const)(
    'keeps a %s subscription on checkout',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('/subscriptions/plans')) {
            return new Response(
              JSON.stringify([MONTHLY_PLAN, PROGRESS_PLAN, FULL_ACCESS_PLAN]),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            );
          }
          if (url.includes('/subscriptions/me')) {
            return new Response(
              JSON.stringify({
                subscription: { ...FULL_ACCESS_SUBSCRIPTION, status },
              }),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            );
          }
          return new Response(null, { status: 404 });
        }),
      );

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
      expect(routerPush).not.toHaveBeenCalled();
    },
  );
});
