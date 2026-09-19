import type { MeResponse, OnboardingResponse } from '@repo/shared-types';
import type { OnboardingInput } from '@repo/validation';
import { apiRequest } from './client';

export function getMe() {
  return apiRequest<MeResponse>('/users/me');
}

export function saveOnboarding(input: OnboardingInput) {
  return apiRequest<OnboardingResponse>('/users/me/onboarding', {
    method: 'PUT',
    body: input,
  });
}
