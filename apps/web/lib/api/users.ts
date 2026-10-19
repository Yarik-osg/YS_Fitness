import type {
  MeResponse,
  OnboardingResponse,
  OnboardingResponsesResponse,
  ProfileUpdateResponse,
  WeightMeasurement,
  WeightMeasurementsResponse,
} from '@repo/shared-types';
import type {
  CreateMeasurementInput,
  OnboardingInput,
  ProfileUpdateInput,
} from '@repo/validation';
import { apiRequest } from './client';

export function getMe() {
  return apiRequest<MeResponse>('/users/me');
}

export function getOnboardingResponses() {
  return apiRequest<OnboardingResponsesResponse>(
    '/users/me/onboarding-responses',
  );
}

export function getMeasurements() {
  return apiRequest<WeightMeasurementsResponse>('/users/me/measurements');
}

export function createMeasurement(input: CreateMeasurementInput) {
  return apiRequest<WeightMeasurement>('/users/me/measurements', {
    method: 'POST',
    body: input,
  });
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
