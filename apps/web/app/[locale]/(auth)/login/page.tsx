import { Suspense } from 'react';
import { LoginForm } from '@/components/features/auth/login-form';
import { PersistPlanIdFromQuery } from '@/components/features/checkout/persist-plan-id';

export default function LoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <PersistPlanIdFromQuery />
      </Suspense>
      <LoginForm />
    </>
  );
}
