import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('is a hidden pulsing block that stays still when motion is reduced', () => {
    render(<Skeleton data-testid="bar" />);

    const bar = screen.getByTestId('bar');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveClass('motion-safe:animate-pulse');
    expect(bar.className).not.toMatch(/(^|\s)animate-pulse(\s|$)/);
  });
});
