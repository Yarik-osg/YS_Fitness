import type { ReactNode } from 'react';
import { CoachGate } from '@/components/auth/auth-gates';
import { CoachShell } from '@/components/features/coach/coach-shell';

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <CoachGate>
      <CoachShell>{children}</CoachShell>
    </CoachGate>
  );
}
