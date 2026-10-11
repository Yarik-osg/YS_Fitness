import { Suspense } from 'react';
import { CheckoutReturnPage } from '@/features/checkout/checkout-return-page';

export default function CheckoutReturnRoute() {
  return (
    <Suspense>
      <CheckoutReturnPage />
    </Suspense>
  );
}
