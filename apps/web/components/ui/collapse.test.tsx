import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { domAnimation, LazyMotion, MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Collapse } from './collapse';

function Harness({ instant = false }: { instant?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <LazyMotion features={domAnimation} strict>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="panel"
        onClick={() => setOpen((value) => !value)}
      >
        Toggle
      </button>
      <Collapse open={open} id="panel" instant={instant}>
        <p>Details</p>
      </Collapse>
    </LazyMotion>
  );
}

describe('Collapse', () => {
  beforeEach(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterEach(() => {
    cleanup();
    MotionGlobalConfig.skipAnimations = true;
  });

  it('keeps the content out of the DOM while closed', () => {
    render(<Harness />);

    expect(screen.queryByText('Details')).not.toBeInTheDocument();
    expect(document.getElementById('panel')).toBeNull();
  });

  it('mounts the content under the controlled id and removes it again', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Toggle' });

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(
      toggle.getAttribute('aria-controls')!,
    );
    expect(panel).toContainElement(screen.getByText('Details'));

    await user.click(toggle);

    await waitFor(() =>
      expect(screen.queryByText('Details')).not.toBeInTheDocument(),
    );
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('also opens and closes when instant', async () => {
    const user = userEvent.setup();
    render(<Harness instant />);
    const toggle = screen.getByRole('button', { name: 'Toggle' });

    await user.click(toggle);
    expect(screen.getByText('Details')).toBeInTheDocument();

    await user.click(toggle);
    await waitFor(() =>
      expect(screen.queryByText('Details')).not.toBeInTheDocument(),
    );
  });

  describe('with real animations', () => {
    beforeEach(() => {
      MotionGlobalConfig.skipAnimations = false;
    });

    it('keeps the panel mounted while it animates closed', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const toggle = screen.getByRole('button', { name: 'Toggle' });
      await user.click(toggle);
      await user.click(toggle);

      // Still leaving: removed only once the exit animation finishes.
      expect(screen.getByText('Details')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByText('Details')).not.toBeInTheDocument(),
      );
    });

    it('closes in the same commit when instant, with no exit animation', async () => {
      const user = userEvent.setup();
      render(<Harness instant />);
      const toggle = screen.getByRole('button', { name: 'Toggle' });
      await user.click(toggle);
      expect(screen.getByText('Details')).toBeInTheDocument();

      await user.click(toggle);

      // No waiting: a scroll measured right after the change must already
      // see the final layout.
      expect(screen.queryByText('Details')).not.toBeInTheDocument();
    });

    it('opens at once when instant', async () => {
      const user = userEvent.setup();
      render(<Harness instant />);

      await user.click(screen.getByRole('button', { name: 'Toggle' }));

      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });
});
