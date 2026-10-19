import type {
  MeResponse,
  OnboardingResponse,
  OnboardingResponsesResponse,
  ProfileUpdateResponse,
  ProgressPhoto,
  ProgressPhotosResponse,
  WeightMeasurement,
  WeightMeasurementsResponse,
} from '@repo/shared-types';
import type {
  CreateMeasurementInput,
  CreateProgressPhotoInput,
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

export function getProgressPhotos() {
  return apiRequest<ProgressPhotosResponse>('/users/me/progress-photos');
}

export function createProgressPhoto(input: CreateProgressPhotoInput) {
  return apiRequest<ProgressPhoto>('/users/me/progress-photos', {
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
