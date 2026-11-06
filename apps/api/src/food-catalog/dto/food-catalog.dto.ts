import {
  createFoodProductSchema,
  foodSearchQuerySchema,
  type CreateFoodProductInput,
  type FoodSearchQuery,
} from '@repo/validation';

export class FoodSearchQueryDto implements FoodSearchQuery {
  static readonly schema = foodSearchQuerySchema;

  q?: string;
  barcode?: string;
}

export class CreateFoodProductDto implements CreateFoodProductInput {
  static readonly schema = createFoodProductSchema;

  name!: string;
  imageUrl?: string | null;
  kcalPer100g!: number;
  proteinPer100g!: number;
  fatPer100g!: number;
  carbsPer100g!: number;
}
