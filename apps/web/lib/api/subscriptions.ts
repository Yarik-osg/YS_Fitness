import type {
  CurrentSubscriptionResponse,
  CheckoutResponse,
  PlanResponse,
} from '@repo/shared-types';
import { apiRequest } from './client';

export function listPlans() {
  return apiRequest<PlanResponse[]>('/subscriptions/plans');
}

export async function getMySubscription() {
  const response =
    await apiRequest<CurrentSubscriptionResponse>('/subscriptions/me');
  return response?.subscription ?? null;
}

export function checkout(planId: string) {
  return apiRequest<CheckoutResponse>('/subscriptions/checkout', {
    method: 'POST',
    body: { planId },
  });
}
