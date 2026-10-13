import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from './sheet';

function Harness({
  dismissible = true,
  onOpenChange,
}: {
  dismissible?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Sheet
        open={open}
        dismissible={dismissible}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
      >
        <SheetContent>
          <SheetTitle>Are you sure?</SheetTitle>
          <SheetDescription>This cannot be undone.</SheetDescription>
          <SheetFooter>
            <button type="button">Confirm</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens as a labelled modal dialog above the page and traps focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Are you sure?',
    });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass('z-[60]');
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('ignores Escape when dismissible is false', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness dismissible={false} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('dialog');
    onOpenChange.mockClear();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
