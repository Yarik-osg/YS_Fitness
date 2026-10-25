export type UserRole = 'CLIENT' | 'ADMIN';
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
  name: string | null;
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
  // Present only for browser sessions when COOKIE_SAME_SITE=none. The page
  // stores this and sends it back as x-csrf-token; it cannot read the cookie
  // the API set on a different host.
  csrfToken?: string;
}

export interface UserProfileResponse {
  name: string | null;
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

export interface WeightMeasurement {
  id: string;
  weightKg: number;
  measuredAt: string;
}

export interface WeightMeasurementsResponse {
  measurements: WeightMeasurement[];
  firstMeasurement: WeightMeasurement | null;
}

export interface ProgressPhoto {
  id: string;
  createdAt: string;
  contentType: 'image/jpeg';
  width: number;
  height: number;
}

export interface ProgressPhotosResponse {
  photos: ProgressPhoto[];
}

export interface StrengthChange {
  exerciseId: string;
  name: string;
  nameEn: string;
  fromKg: number;
  toKg: number;
}

export interface StrengthChangesResponse {
  changes: StrengthChange[];
}

export interface CoachClientSummary {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  programAssigned: boolean;
  subscriptionActive: boolean;
}

export interface CoachClientsResponse {
  clients: CoachClientSummary[];
}

export interface CoachClientProfile {
  dateOfBirth: string;
  biologicalSexForCalculation: BiologicalSexForCalculation;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
  timezone: string;
}

export interface CoachClientOnboarding {
  programTrack: ProgramTrack;
  currentBody: string;
  desiredBody: string;
  mainGoal: OnboardingMainGoal;
  experience: TrainingExperience;
  trainingFrequency: TrainingFrequency;
  focusAreas: string[];
  nutritionCurrent: NutritionCurrent;
  mealsPerDay: string;
  eatingHabits: string[];
  physiqueLevel: string | null;
}

export interface CoachClientProgram {
  accent: ProgramAccent;
  templateCode: string;
  templateName: string;
  level: TrainingExperience;
  frequencyPerWeek: number;
  gender: ProgramTrack;
  origin: ProgramOrigin;
  assignmentSource: AssignmentSource;
  assignedAt: string;
}

export interface CoachClientSubscription {
  active: boolean;
  status: SubscriptionStatus;
  planName: string;
  currentPeriodEnd: string | null;
}

export interface CoachClientDetail {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  profile: CoachClientProfile | null;
  onboarding: CoachClientOnboarding | null;
  program: CoachClientProgram | null;
  subscription: CoachClientSubscription | null;
}

export interface CoachClientWorkoutSet {
  order: number;
  setNumber: number;
  repsCompleted: number;
  weightKg: number | null;
  exercise: { name: string; nameEn: string };
}

export interface CoachClientWorkoutLog {
  id: string;
  completedAt: string;
  dayNumber: number;
  templateCode: string;
  templateName: string;
  sets: CoachClientWorkoutSet[];
}

export interface CoachClientWorkoutsResponse {
  logs: CoachClientWorkoutLog[];
  total: number;
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

export type ProgramTrack = 'female' | 'male';
export type OnboardingMainGoal =
  'lose_weight' | 'build_muscle' | 'improve_body' | 'maintain' | 'get_stronger';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingFrequency = '2' | '3' | '4';
export type NutritionCurrent =
  'structured' | 'balanced' | 'intuitive' | 'irregular' | 'uncontrolled';

export interface OnboardingResponsesRecord {
  programTrack: ProgramTrack;
  currentBody: string;
  desiredBody: string;
  mainGoal: OnboardingMainGoal;
  experience: TrainingExperience;
  trainingFrequency: TrainingFrequency;
  focusAreas: string[];
  nutritionCurrent: NutritionCurrent;
  mealsPerDay: string;
  eatingHabits: string[];
  physiqueLevel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingResponsesResponse {
  responses: OnboardingResponsesRecord | null;
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

export type MuscleGroup =
  | 'GLUTES'
  | 'QUADRICEPS'
  | 'HAMSTRINGS'
  | 'BACK'
  | 'BICEPS'
  | 'TRICEPS'
  | 'CHEST'
  | 'SHOULDERS'
  | 'ABS'
  | 'REAR_DELTOIDS'
  | 'CALVES';

export type ProgramAccent =
  'NONE' | 'UPPER' | 'LOWER' | 'BACK' | 'CHEST' | 'SHOULDERS' | 'ARMS' | 'LEGS';

export type ProgramOrigin = 'SYSTEM' | 'TRAINER';

export type AssignmentSource = 'MATCHED' | 'ADMIN';

export interface ExerciseResponse {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  muscleGroups: MuscleGroup[];
  repsMin: number;
  repsMax: number;
}

export interface ProgramExerciseResponse {
  order: number;
  sets: number;
  allowsAbsAddon: boolean;
  exercise: ExerciseResponse;
}

export interface ProgramDayResponse {
  dayNumber: number;
  exercises: ProgramExerciseResponse[];
}

export interface ProgramProgress {
  completed: number;
  expected: number;
}

export interface DayLogCount {
  dayNumber: number;
  count: number;
}

export interface AssignedProgramSummary {
  id: string;
  templateId: string;
  templateCode: string;
  templateName: string;
  gender: ProgramTrack;
  level: TrainingExperience;
  frequencyPerWeek: number;
  accent: ProgramAccent;
  templateOrigin: ProgramOrigin;
  assignmentSource: AssignmentSource;
  assignedAt: string;
  nextDayNumber: number;
  programProgress: ProgramProgress;
  dayLogCounts: DayLogCount[];
}

export interface AssignedProgramResponse extends AssignedProgramSummary {
  days: ProgramDayResponse[];
}

export interface CurrentProgramResponse {
  program: AssignedProgramResponse | null;
}

export interface AssignedProgramLookupResponse {
  program: AssignedProgramSummary | null;
}

export interface ProgramPromotionSuggestion {
  id: string;
  code: string;
  name: string;
  accent: ProgramAccent;
  level: TrainingExperience;
  frequencyPerWeek: number;
}

export interface ProgramPromotion {
  kind: 'level-up' | 'zone-change';
  fromLevel: TrainingExperience;
  toLevel: TrainingExperience;
  suggestions: ProgramPromotionSuggestion[];
}

/** Sessions in one block: eight weeks at the program's weekly frequency. */
export function expectedProgramSessions(frequencyPerWeek: number): number {
  return frequencyPerWeek * 8;
}

export interface ProfileUpdateResponse {
  heightCm: number;
  weightKg: number;
  experience: TrainingExperience | null;
  mainGoal: OnboardingMainGoal | null;
  trainingFrequency: TrainingFrequency | null;
  program: AssignedProgramSummary | null;
}

export type WeightRecommendation = 'increase' | 'decrease';

export interface WorkoutLogSetResponse {
  id: string;
  exerciseId: string;
  order: number;
  setNumber: number;
  repsCompleted: number;
  weightKg: number | null;
  recommendation: WeightRecommendation | null;
  exercise: ExerciseResponse;
}

export interface WorkoutLogResponse {
  id: string;
  userId: string;
  templateId: string;
  dayNumber: number;
  completedAt: string;
  sets: WorkoutLogSetResponse[];
}

export interface WorkoutLogListResponse {
  logs: WorkoutLogResponse[];
  total: number;
}

export interface WorkoutCalendarResponse {
  logs: WorkoutLogResponse[];
}

export interface TrainerProgramTemplateSummary {
  id: string;
  code: string;
  name: string;
  gender: ProgramTrack;
  level: TrainingExperience;
  frequencyPerWeek: number;
  accent: ProgramAccent;
  origin: ProgramOrigin;
  active: boolean;
  ownerId: string | null;
  dayCount: number;
  exerciseCount: number;
}

export interface TrainerProgramTemplateDetail extends TrainerProgramTemplateSummary {
  days: ProgramDayResponse[];
}

export interface TrainerProgramTemplateListResponse {
  templates: TrainerProgramTemplateSummary[];
}
