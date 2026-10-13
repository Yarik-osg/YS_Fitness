import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { BirthDateField } from './birth-date-field';

describe('BirthDateField', () => {
  afterEach(() => {
    cleanup();
  });

  it('stores the picked day as an ISO date and stops at this year', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <I18nTestProvider locale="en">
        <BirthDateField id="dateOfBirth" onChange={onChange} />
      </I18nTestProvider>,
    );

    await user.click(screen.getByRole('button', { name: '—' }));
    const year = new Date().getFullYear() - 25;
    await user.click(
      screen.getByRole('button', { name: new RegExp(`January 15th, ${year}`) }),
    );

    expect(onChange).toHaveBeenCalledWith(`${year}-01-15`);
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { expanded: false }));
    const nextYear = String(new Date().getFullYear() + 1);
    expect(
      screen.queryByRole('option', { name: nextYear }),
    ).not.toBeInTheDocument();
  });
});
