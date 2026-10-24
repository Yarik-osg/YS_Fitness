'use client';

import { Toaster as Sonner } from 'sonner';

const ERROR_DURATION_MS = 6_000;

/**
 * App-wide toast host. Kept at the top so it stays clear of the bottom nav
 * and the workout finish bar. Errors stay up a little longer than successes.
 */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      duration={4_000}
      className="mx-auto w-full max-w-[430px]"
      toastOptions={{
        classNames: {
          toast:
            'font-label border border-white/10 bg-panel text-white shadow-overlay',
          success: 'border-l-2 border-l-lime',
          error: 'border-l-2 border-l-red-400 text-red-300',
          title: 'text-[13px]',
        },
      }}
    />
  );
}

export { ERROR_DURATION_MS };
