import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('sends the hero CTA to registration', () => {
    render(<LandingPage />);

    const heroCta = screen.getAllByRole('link', { name: /Почати зміни/i })[0];
    expect(heroCta).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /Увійти/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('renders illustrative plan buttons as disabled', () => {
    render(<LandingPage />);

    const threeMonths = screen.getAllByRole('button', {
      name: /Обрати 3 місяці/i,
    });
    const oneMonth = screen.getAllByRole('button', {
      name: /Обрати 1 місяць/i,
    });

    expect(threeMonths.length).toBeGreaterThan(0);
    expect(oneMonth.length).toBeGreaterThan(0);
    for (const button of [...threeMonths, ...oneMonth]) {
      expect(button).toBeDisabled();
    }
  });
});
