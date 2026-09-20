'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { persistSelectedPlanId } from '@/lib/subscriptions/selected-plan';

export function PersistPlanIdFromQuery() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const planId = searchParams.get('planId');
    if (planId) persistSelectedPlanId(planId);
  }, [searchParams]);

  return null;
}
