import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { LocaleSwitcher } from './locale-switcher';

const replace = vi.fn();
const searchParams = new URLSearchParams();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/login',
  useRouter: () => ({ replace }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

describe('LocaleSwitcher', () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
    for (const key of [...searchParams.keys()]) {
      searchParams.delete(key);
    }
  });

  it('keeps the current route when switching locale', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider locale="uk">
        <LocaleSwitcher />
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Змінити мову/i }));

    expect(replace).toHaveBeenCalledWith(
      { pathname: '/login', query: {} },
      { locale: 'en' },
    );
  });

  it('remaps the next locale prefix when switching language', async () => {
    searchParams.set('next', '/uk/dashboard');
    const user = userEvent.setup();
    render(
      <I18nTestProvider locale="uk">
        <LocaleSwitcher />
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Змінити мову/i }));

    expect(replace).toHaveBeenCalledWith(
      { pathname: '/login', query: { next: '/en/dashboard' } },
      { locale: 'en' },
    );
  });

  it('labels the chip as EN when the locale is English', () => {
    render(
      <I18nTestProvider locale="en">
        <LocaleSwitcher />
      </I18nTestProvider>,
    );

    const chip = screen.getByRole('button', { name: /Change language/i });
    expect(chip).toHaveTextContent('EN');
    expect(chip.querySelector('svg')).toBeNull();
  });
});
