import { ApiClientError } from './client';

const ERROR_CODES = [
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_CREDENTIALS',
  'INVALID_DATE_OF_BIRTH',
  'INVALID_TIMEZONE',
  'REFRESH_TOKEN_REQUIRED',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_REUSED',
  'SESSION_REVOKED',
  'TOO_MANY_REQUESTS',
  'NETWORK_ERROR',
] as const;

type KnownErrorCode = (typeof ERROR_CODES)[number];

export type AuthErrorMessageKey =
  `errors.${KnownErrorCode}` | 'errors.SERVER_ERROR' | 'errors.UNKNOWN';

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return ERROR_CODES.includes(code as KnownErrorCode);
}

export function getUserFacingErrorKey(error: unknown): AuthErrorMessageKey {
  if (error instanceof ApiClientError) {
    if (isKnownErrorCode(error.code)) {
      return `errors.${error.code}`;
    }

    return error.status >= 500 ? 'errors.SERVER_ERROR' : 'errors.UNKNOWN';
  }

  return 'errors.UNKNOWN';
}

export function getUserFacingError(
  error: unknown,
  t: (key: AuthErrorMessageKey) => string,
) {
  if (error instanceof ApiClientError && !isKnownErrorCode(error.code)) {
    if (error.status < 500) {
      return error.message;
    }
  }

  return t(getUserFacingErrorKey(error));
}
