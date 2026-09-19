import { onboardingSchema, type OnboardingInput } from '@repo/validation';

export class OnboardingDto implements OnboardingInput {
  static readonly schema = onboardingSchema;

  dateOfBirth!: string;
  biologicalSexForCalculation!: 'MALE' | 'FEMALE';
  heightCm!: number;
  weightKg!: number;
  bodyFatPercent?: number;
  activityLevel!:
    | 'SEDENTARY'
    | 'LIGHTLY_ACTIVE'
    | 'MODERATELY_ACTIVE'
    | 'VERY_ACTIVE'
    | 'EXTRA_ACTIVE';
  goal!: 'LOSE_WEIGHT' | 'MAINTAIN_WEIGHT' | 'GAIN_WEIGHT';
  healthRestrictions?: { type: string }[];
  timezone!: string;
}
