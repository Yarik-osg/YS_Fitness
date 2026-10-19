import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { BirthDateField } from './birth-date-field';

describe('BirthDateField', () => {
  afterEach(() => {
    cleanup();
  });

  it('stores day, month, and year as an ISO date and stops at this year', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <I18nTestProvider locale="en">
        <BirthDateField
          id="dateOfBirth"
          label="Date of birth"
          onChange={onChange}
        />
      </I18nTestProvider>,
    );

    const year = new Date().getUTCFullYear() - 25;
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Month' }),
      'January',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Day' }),
      '15',
    );
    expect(onChange).not.toHaveBeenCalled();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Year' }),
      String(year),
    );

    expect(onChange).toHaveBeenCalledWith(`${year}-01-15`);
    expect(
      within(screen.getByRole('combobox', { name: 'Year' })).queryByRole(
        'option',
        { name: String(new Date().getUTCFullYear() + 1) },
      ),
    ).not.toBeInTheDocument();
  });

  it('shortens the day when the month is shorter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <I18nTestProvider locale="en">
        <BirthDateField
          id="dateOfBirth"
          label="Date of birth"
          value="2001-01-31"
          onChange={onChange}
        />
      </I18nTestProvider>,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Month' }),
      'February',
    );

    expect(onChange).toHaveBeenCalledWith('2001-02-28');
  });

  it('clamps day 31 to February before a year is chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <I18nTestProvider locale="en">
        <BirthDateField
          id="dateOfBirth"
          label="Date of birth"
          onChange={onChange}
        />
      </I18nTestProvider>,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Day' }),
      '31',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Month' }),
      'February',
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Day' })).toHaveValue('28');
  });
});
