import type {
  CurrentSubscriptionResponse,
  CheckoutResponse,
  PlanResponse,
  SubscriptionResponse,
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

export function grantSubscription(body: { userId: string; planId: string }) {
  return apiRequest<SubscriptionResponse>('/subscriptions/grant', {
    method: 'POST',
    body,
  });
}

export function checkout(planId: string) {
  return apiRequest<CheckoutResponse>('/subscriptions/checkout', {
    method: 'POST',
    body: { planId },
  });
}

export function renewSubscription(planId: string) {
  return apiRequest<CheckoutResponse>('/subscriptions/renew', {
    method: 'POST',
    body: { planId },
  });
}
