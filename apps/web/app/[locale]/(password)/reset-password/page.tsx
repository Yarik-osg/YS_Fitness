import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/features/auth/reset-password-form';

// The link carries a secret in its query string; keep it out of Referer.
export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
