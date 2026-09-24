import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BodyPhysiqueSlider } from './physique-slider';

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderSlider({
  track = 'female' as const,
  value,
}: {
  track?: 'female' | 'male';
  value?: string;
} = {}) {
  const onChange = vi.fn();
  render(
    <BodyPhysiqueSlider
      track={track}
      value={value}
      onChange={onChange}
      label="Overall physique"
      valueLabel={(index) => `Option ${index + 1}`}
    />,
  );
  return onChange;
}

function slider() {
  return screen.getByRole('slider', { name: 'Overall physique' });
}

function mockTrackRect() {
  vi.spyOn(slider(), 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 32,
    right: 450,
    width: 450,
    height: 32,
    toJSON: () => ({}),
  });
}

describe('BodyPhysiqueSlider', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reaches all ten female positions with the arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = renderSlider();
    slider().focus();

    await user.keyboard(
      '{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}',
    );
    expect(onChange.mock.calls.map((call) => call[0])).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);
    expect(slider()).toHaveAttribute('aria-valuenow', '9');
  });

  it('reaches all ten male positions with Home, End, and arrows', async () => {
    const user = userEvent.setup();
    const onChange = renderSlider({ track: 'male' });
    slider().focus();

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('9');
    expect(document.querySelector('[data-physique-src]')).toHaveAttribute(
      'data-physique-src',
      '/marketing/body-slider/male-9.svg',
    );

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('0');
  });

  it('snaps a drag onto the nearest discrete step', () => {
    const onChange = renderSlider();
    mockTrackRect();

    fireEvent.pointerDown(slider(), { clientX: 250, pointerId: 1 });
    fireEvent.pointerMove(slider(), { clientX: 250, pointerId: 1 });
    fireEvent.pointerUp(slider(), { clientX: 250, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith('5');
    expect(slider()).toHaveAttribute('aria-valuenow', '5');
  });

  it('crossfades the two nearest illustrations while dragging', () => {
    renderSlider({ value: '0' });
    mockTrackRect();

    fireEvent.pointerDown(slider(), { clientX: 225, pointerId: 1 });
    fireEvent.pointerMove(slider(), { clientX: 225, pointerId: 1 });

    const lower = document.querySelector('[data-physique-index="4"]');
    const upper = document.querySelector('[data-physique-index="5"]');
    expect(lower).toHaveStyle({ opacity: '0.5' });
    expect(upper).toHaveStyle({ opacity: '0.5' });
  });

  it('skips the crossfade transition when reduced motion is preferred', () => {
    mockMatchMedia(true);
    renderSlider({ value: '4' });
    mockTrackRect();

    fireEvent.pointerDown(slider(), { clientX: 225, pointerId: 1 });
    fireEvent.pointerMove(slider(), { clientX: 225, pointerId: 1 });

    const frames = document.querySelectorAll('[data-physique-index]');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute('data-physique-index', '5');
    expect(frames[0]).not.toHaveClass('transition-opacity');
  });
});
