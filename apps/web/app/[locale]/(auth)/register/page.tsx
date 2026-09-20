import { Suspense } from 'react';
import { RegisterForm } from '@/components/features/auth/register-form';
import { PersistPlanIdFromQuery } from '@/components/features/checkout/persist-plan-id';

export default function RegisterPage() {
  return (
    <>
      <Suspense fallback={null}>
        <PersistPlanIdFromQuery />
      </Suspense>
      <RegisterForm />
    </>
  );
}
