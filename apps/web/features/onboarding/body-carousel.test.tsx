import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BodyCarousel } from './body-carousel';
import { currentBodyPhoto } from './body-figure';

const choices = [0, 1, 2].map((step) => ({
  value: String(step),
  label: `Варіант ${step + 1}`,
  image: currentBodyPhoto('male', step),
}));

describe('BodyCarousel', () => {
  afterEach(() => {
    cleanup();
  });

  it('moves the current form with the slider', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BodyCarousel
        choices={choices}
        value="0"
        label="Статура"
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Статура' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('1');
  });
});
