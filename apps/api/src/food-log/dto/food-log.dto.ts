import {
  createFoodLogSchema,
  foodLogParamsSchema,
  foodLogQuerySchema,
  foodProductParamsSchema,
  foodRecentQuerySchema,
  patchFoodLogSchema,
  type CreateFoodLogInput,
  type FoodLogParams,
  type FoodLogQuery,
  type FoodProductParams,
  type FoodRecentQuery,
  type PatchFoodLogInput,
} from '@repo/validation';

export class FoodProductParamsDto implements FoodProductParams {
  static readonly schema = foodProductParamsSchema;

  productId!: string;
}

export class FoodRecentQueryDto implements FoodRecentQuery {
  static readonly schema = foodRecentQuerySchema;

  limit!: number;
}

export class FoodLogQueryDto implements FoodLogQuery {
  static readonly schema = foodLogQuerySchema;

  date!: string;
}

export class CreateFoodLogDto implements CreateFoodLogInput {
  static readonly schema = createFoodLogSchema;

  productId!: string;
  grams!: number;
  meal!: CreateFoodLogInput['meal'];
  loggedOn!: string;
}

export class FoodLogParamsDto implements FoodLogParams {
  static readonly schema = foodLogParamsSchema;

  id!: string;
}

export class PatchFoodLogDto implements PatchFoodLogInput {
  static readonly schema = patchFoodLogSchema;

  grams?: number;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  meal?: PatchFoodLogInput['meal'];
  productName?: string;
  saveAsMyProduct?: boolean;
}
