import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivitySlider } from './activity-slider';

const labels = {
  SEDENTARY: { label: 'Сидяча', description: 'Більшість дня сиджу' },
  LIGHTLY_ACTIVE: { label: 'Невисока', description: 'Мало рухаюсь' },
  MODERATELY_ACTIVE: {
    label: 'Середня',
    description: 'Багато ходжу та регулярно в русі',
  },
  VERY_ACTIVE: {
    label: 'Висока',
    description: 'Фізично активний більшість дня',
  },
};

describe('ActivitySlider', () => {
  afterEach(() => {
    cleanup();
  });

  it('selects a daily activity stop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ActivitySlider
        value="MODERATELY_ACTIVE"
        labels={labels}
        label="Рівень активності"
        onChange={onChange}
      />,
    );

    expect(
      screen.getByText('Багато ходжу та регулярно в русі'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', { name: 'Рівень активності' }),
    ).toHaveAttribute('aria-valuenow', '2');
    await user.click(screen.getByRole('button', { name: 'Сидяча' }));
    expect(onChange).toHaveBeenCalledWith('SEDENTARY');
  });
});
