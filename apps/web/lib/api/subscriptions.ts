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

export async function getMyCheckout() {
  const response =
    await apiRequest<CurrentSubscriptionResponse>('/subscriptions/me');
  return {
    subscription: response?.subscription ?? null,
    checkoutUrl: response?.checkoutUrl ?? null,
  };
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

export function completeMockPayment(input: {
  providerReference: string;
  expiresAt: number;
  signature: string;
}) {
  return apiRequest<SubscriptionResponse>('/subscriptions/webhooks/mock', {
    method: 'POST',
    body: input,
  });
}
