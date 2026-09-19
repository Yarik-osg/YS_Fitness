import type { ReactNode } from 'react';
import { AuthGate } from '@/components/auth/auth-gates';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
