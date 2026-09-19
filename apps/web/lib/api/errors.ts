import { ApiClientError } from './client';

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_REGISTERED: 'An account already exists for this email.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  INVALID_DATE_OF_BIRTH: 'Enter a valid date of birth.',
  INVALID_TIMEZONE: 'Your browser timezone could not be recognized.',
  REFRESH_TOKEN_REQUIRED: 'Your session has expired. Please sign in again.',
  REFRESH_TOKEN_INVALID: 'Your session has expired. Please sign in again.',
  REFRESH_TOKEN_REUSED: 'For your security, please sign in again.',
  SESSION_REVOKED: 'Your session has ended. Please sign in again.',
  TOO_MANY_REQUESTS: 'Too many attempts. Wait a moment and try again.',
  NETWORK_ERROR: 'The service is unavailable. Check your connection and retry.',
};

export function getUserFacingError(error: unknown) {
  if (error instanceof ApiClientError) {
    return (
      ERROR_MESSAGES[error.code] ??
      (error.status >= 500
        ? 'Something went wrong on our side. Please try again.'
        : error.message)
    );
  }

  return 'Something went wrong. Please try again.';
}
