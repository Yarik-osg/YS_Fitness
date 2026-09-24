'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  checkout,
  getMySubscription,
  listPlans,
} from '@/lib/api/subscriptions';

export const plansQueryKey = ['subscriptions', 'plans'] as const;
export const mySubscriptionQueryKey = ['subscriptions', 'me'] as const;

export function usePlans() {
  return useQuery({
    queryKey: plansQueryKey,
    queryFn: listPlans,
    retry: 2,
  });
}

export function useMySubscription(enabled = true) {
  return useQuery({
    queryKey: mySubscriptionQueryKey,
    queryFn: getMySubscription,
    enabled,
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => checkout(planId),
    onSuccess: (response) => {
      queryClient.setQueryData(mySubscriptionQueryKey, response.subscription);
    },
  });
}
