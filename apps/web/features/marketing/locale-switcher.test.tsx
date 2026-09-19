import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { LocaleSwitcher } from './locale-switcher';

const replace = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/register',
  useRouter: () => ({ replace }),
}));

describe('LocaleSwitcher', () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
  });

  it('keeps the current route when switching locale', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider locale="uk">
        <LocaleSwitcher />
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Змінити мову/i }));

    expect(replace).toHaveBeenCalledWith('/register', { locale: 'en' });
  });

  it('labels the chip as EN when the locale is English', () => {
    render(
      <I18nTestProvider locale="en">
        <LocaleSwitcher />
      </I18nTestProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Change language/i }),
    ).toHaveTextContent('EN');
  });
});
