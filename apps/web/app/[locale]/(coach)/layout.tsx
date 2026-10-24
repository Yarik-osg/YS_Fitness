import type { ReactNode } from 'react';
import { CoachGate } from '@/components/auth/auth-gates';

export default function CoachLayout({ children }: { children: ReactNode }) {
  return <CoachGate>{children}</CoachGate>;
}
