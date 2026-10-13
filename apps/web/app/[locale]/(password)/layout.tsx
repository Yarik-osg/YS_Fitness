import type { ReactNode } from 'react';

/**
 * Unlike (auth), no GuestGate: a signed-in browser must still be able to open
 * an emailed reset link.
 */
export default function PasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
