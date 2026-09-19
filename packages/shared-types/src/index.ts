export type UserRole = 'CLIENT' | 'TRAINER' | 'ADMIN';

export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  onboardingCompletedAt: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  details?: unknown;
}
