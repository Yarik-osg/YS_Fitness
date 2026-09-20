export type UserRole = 'CLIENT' | 'TRAINER' | 'ADMIN';
export type BiologicalSexForCalculation = 'MALE' | 'FEMALE';
export type ActivityLevel =
  | 'SEDENTARY'
  | 'LIGHTLY_ACTIVE'
  | 'MODERATELY_ACTIVE'
  | 'VERY_ACTIVE'
  | 'EXTRA_ACTIVE';
export type WeightGoal = 'LOSE_WEIGHT' | 'MAINTAIN_WEIGHT' | 'GAIN_WEIGHT';

export interface HealthRestriction {
  type: string;
}

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

export interface UserProfileResponse {
  dateOfBirth: string;
  biologicalSexForCalculation: BiologicalSexForCalculation;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
  healthRestrictions: HealthRestriction[] | null;
  timezone: string;
  onboardingCompletedAt: string;
}

export interface BodyMeasurementResponse {
  id: string;
  weightKg: string;
  bodyFatPercent: string | null;
  measuredAt: string;
}

export interface MeResponse {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  profile: UserProfileResponse | null;
  bodyMeasurements: BodyMeasurementResponse[];
}

export interface OnboardingResponse {
  profile: UserProfileResponse;
  measurement: BodyMeasurementResponse;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  details?: unknown;
}

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'CANCELED' | 'EXPIRED';
export type PaymentProvider = 'MOCK' | 'MANUAL' | 'WAYFORPAY';

export interface PlanResponse {
  id: string;
  code: string;
  name: string;
  priceAmount: number;
  currency: string;
  intervalMonths: number;
  isActive: boolean;
}

export interface SubscriptionResponse {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  providerReference: string | null;
  currentPeriodEnd: string | null;
  grantedByUserId: string | null;
  createdAt: string;
  plan: PlanResponse;
}

export interface CheckoutResponse {
  subscription: SubscriptionResponse;
  checkoutUrl: string | null;
}

export interface CurrentSubscriptionResponse {
  subscription: SubscriptionResponse | null;
}
