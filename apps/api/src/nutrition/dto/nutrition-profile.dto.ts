import {
  nutritionProfileSchema,
  type NutritionProfileInput,
} from '@repo/validation';

export class NutritionProfileDto implements NutritionProfileInput {
  static readonly schema = nutritionProfileSchema;

  activity!: NutritionProfileInput['activity'];
  goal!: NutritionProfileInput['goal'];
  preferences!: NutritionProfileInput['preferences'];
  allergies!: NutritionProfileInput['allergies'];
  dislikes!: NutritionProfileInput['dislikes'];
  mealCount!: number;
}
