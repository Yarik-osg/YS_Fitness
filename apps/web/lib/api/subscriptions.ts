import type {
  CheckoutResponse,
  PlanResponse,
  SubscriptionResponse,
} from '@repo/shared-types';
import { apiRequest } from './client';

export function listPlans() {
  return apiRequest<PlanResponse[]>('/subscriptions/plans');
}

export function getMySubscription() {
  return apiRequest<SubscriptionResponse | null>('/subscriptions/me');
}

export function checkout(planId: string) {
  return apiRequest<CheckoutResponse>('/subscriptions/checkout', {
    method: 'POST',
    body: { planId },
  });
}
