import { cleanup, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';
import { Toaster } from './toaster';

describe('Toaster', () => {
  afterEach(() => {
    cleanup();
  });

  it('announces success and error inside a live region', async () => {
    render(<Toaster />);

    toast.success('Saved');
    const success = await screen.findByText('Saved');
    expect(success.closest('[aria-live]')).not.toBeNull();

    toast.error('Failed');
    const error = await screen.findByText('Failed');
    expect(error.closest('[aria-live]')).not.toBeNull();
  });
});
