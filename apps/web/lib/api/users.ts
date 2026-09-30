import type {
  MeResponse,
  OnboardingResponse,
  OnboardingResponsesResponse,
  ProfileUpdateResponse,
} from '@repo/shared-types';
import type { OnboardingInput, ProfileUpdateInput } from '@repo/validation';
import { apiRequest } from './client';

export function getMe() {
  return apiRequest<MeResponse>('/users/me');
}

export function getOnboardingResponses() {
  return apiRequest<OnboardingResponsesResponse>(
    '/users/me/onboarding-responses',
  );
}

export function updateProfile(input: ProfileUpdateInput) {
  return apiRequest<ProfileUpdateResponse>('/users/me/profile', {
    method: 'PATCH',
    body: input,
  });
}

export function saveOnboarding(input: OnboardingInput) {
  return apiRequest<OnboardingResponse>('/users/me/onboarding', {
    method: 'PUT',
    body: input,
  });
}
