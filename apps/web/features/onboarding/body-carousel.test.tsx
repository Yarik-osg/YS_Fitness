import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BodyCarousel } from './body-carousel';

const choices = [
  {
    value: 'slim',
    label: 'Варіант 1',
    image: '/marketing/body-slider/male-0.svg',
  },
  {
    value: 'toned',
    label: 'Варіант 2',
    image: '/marketing/body-slider/male-2.svg',
  },
  {
    value: 'athletic',
    label: 'Варіант 3',
    image: '/marketing/body-slider/male-4.svg',
  },
];

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
        value="slim"
        label="Статура"
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Статура' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('toned');
  });
});
