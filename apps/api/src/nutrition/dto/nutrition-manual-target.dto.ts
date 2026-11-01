import {
  nutritionManualTargetSchema,
  type NutritionManualTargetInput,
} from '@repo/validation';

export class NutritionManualTargetDto implements NutritionManualTargetInput {
  static readonly schema = nutritionManualTargetSchema;

  targetCalories!: string;
  proteinGrams!: string;
  fatGrams!: string;
  carbsGrams!: string;
}
