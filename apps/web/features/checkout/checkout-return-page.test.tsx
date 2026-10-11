import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { CheckoutReturnPage } from './checkout-return-page';

const api = vi.hoisted(() => ({
  completeMockPayment: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
const search = vi.hoisted(() => ({
  current: new URLSearchParams(),
}));

vi.mock('@/lib/api/subscriptions', () => ({
  completeMockPayment: (...args: unknown[]) => api.completeMockPayment(...args),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => search.current,
}));

describe('CheckoutReturnPage', () => {
  beforeEach(() => {
    search.current = new URLSearchParams();
    api.completeMockPayment.mockReset();
    router.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows an error when the return signature is missing', async () => {
    render(
      <I18nTestProvider>
        <CheckoutReturnPage />
      </I18nTestProvider>,
    );

    expect(
      await screen.findByText(/не вдалося підтвердити підписку/i),
    ).toBeInTheDocument();
    expect(api.completeMockPayment).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('completes mock payment and sends the member to the dashboard', async () => {
    search.current = new URLSearchParams({
      providerReference: 'pay_first',
      expiresAt: '1800000000',
      signature: 'signed',
    });
    api.completeMockPayment.mockResolvedValue({ status: 'ACTIVE' });

    render(
      <I18nTestProvider>
        <CheckoutReturnPage />
      </I18nTestProvider>,
    );

    expect(screen.getByText(/підтверджуємо доступ/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(api.completeMockPayment).toHaveBeenCalledWith({
        providerReference: 'pay_first',
        expiresAt: 1_800_000_000,
        signature: 'signed',
      });
      expect(router.replace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows an error when mock payment completion fails', async () => {
    search.current = new URLSearchParams({
      providerReference: 'pay_first',
      expiresAt: '1800000000',
      signature: 'signed',
    });
    api.completeMockPayment.mockRejectedValue(new Error('declined'));

    render(
      <I18nTestProvider>
        <CheckoutReturnPage />
      </I18nTestProvider>,
    );

    expect(
      await screen.findByText(/не вдалося підтвердити підписку/i),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
