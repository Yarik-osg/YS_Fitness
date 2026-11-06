import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FoodLogEntry } from '@prisma/client';
import type {
  ActiveNutritionTarget,
  FoodDayResponse,
  FoodLogEntryResponse,
  FoodMacroTotal,
  FoodProductListResponse,
  FoodProductResponse,
} from '@repo/shared-types';
import {
  foodPer100gSchema,
  type CreateFoodLogInput,
  type PatchFoodLogInput,
} from '@repo/validation';
import { roundHalfUp } from '../common/round-half-up.js';
import { FoodCatalogService } from '../food-catalog/food-catalog.service.js';
import { toFoodProduct } from '../food-catalog/food-product.js';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { FoodLogRepository } from './food-log.repository.js';
import {
  applyFoodLogPatch,
  calendarDateToUtc,
  entryDecimal,
  entryFitsGrams,
  formatCalendarDate,
  per100gFromSnapshot,
  snapshotFromPer100g,
} from './food-snapshot.js';

@Injectable()
export class FoodLogService {
  constructor(
    private readonly entries: FoodLogRepository,
    private readonly catalog: FoodCatalogService,
    private readonly nutrition: NutritionService,
  ) {}

  async listFavorites(userId: string): Promise<FoodProductListResponse> {
    const links = await this.entries.listFavorites(userId);
    const products = await this.catalog.findVisibleByIds(
      userId,
      links.map((link) => link.productId),
    );
    const byId = new Map(products.map((product) => [product.id, product]));
    return {
      products: links.flatMap((link) => {
        const product = byId.get(link.productId);
        return product ? [toFoodProduct(product)] : [];
      }),
    };
  }

  async favorite(
    userId: string,
    productId: string,
  ): Promise<FoodProductResponse> {
    const product = await this.catalog.findVisible(userId, productId);
    if (!product) throw productNotFound();
    await this.entries.favorite(userId, productId);
    return toFoodProduct(product);
  }

  async unfavorite(userId: string, productId: string): Promise<void> {
    await this.entries.unfavorite(userId, productId);
  }

  async day(userId: string, date: string): Promise<FoodDayResponse> {
    const rows = await this.entries.listDay(userId, calendarDateToUtc(date));
    const totals = rows.reduce(
      (sum, row) => ({
        kcal: sum.kcal.plus(row.kcal),
        protein: sum.protein.plus(row.protein),
        fat: sum.fat.plus(row.fat),
        carbs: sum.carbs.plus(row.carbs),
      }),
      {
        kcal: new Prisma.Decimal(0),
        protein: new Prisma.Decimal(0),
        fat: new Prisma.Decimal(0),
        carbs: new Prisma.Decimal(0),
      },
    );
    const target = await this.nutrition.getActiveTarget(userId);
    const summed = {
      kcal: totals.kcal.toNumber(),
      protein: totals.protein.toNumber(),
      fat: totals.fat.toNumber(),
      carbs: totals.carbs.toNumber(),
    };
    return {
      date,
      entries: rows.map(toEntry),
      totals: summed,
      target,
      remaining: target ? remaining(target, totals) : null,
    };
  }

  async create(
    userId: string,
    input: CreateFoodLogInput,
  ): Promise<FoodLogEntryResponse> {
    const product = await this.catalog.findVisible(userId, input.productId);
    if (!product) throw productNotFound();
    const snapshot = snapshotFromPer100g(toFoodProduct(product), input.grams);
    const created = await this.entries.create({
      userId,
      productId: product.id,
      loggedOn: calendarDateToUtc(input.loggedOn),
      meal: input.meal,
      grams: entryDecimal(input.grams),
      productName: product.name,
      imageUrl: product.imageUrl,
      kcal: entryDecimal(snapshot.kcal),
      protein: entryDecimal(snapshot.protein),
      fat: entryDecimal(snapshot.fat),
      carbs: entryDecimal(snapshot.carbs),
    });
    return toEntry(created);
  }

  async update(
    userId: string,
    entryId: string,
    input: PatchFoodLogInput,
  ): Promise<FoodLogEntryResponse> {
    return this.entries.transaction(async (db) => {
      const entry = await this.entries.lockOwned(userId, entryId, db);
      if (!entry) throw entryNotFound();
      const next = applyFoodLogPatch(
        {
          grams: entry.grams.toNumber(),
          kcal: entry.kcal.toNumber(),
          protein: entry.protein.toNumber(),
          fat: entry.fat.toNumber(),
          carbs: entry.carbs.toNumber(),
        },
        input,
      );
      if (!entryFitsGrams(next)) throw valuesOutOfRange();
      const data = {
        productId: entry.productId,
        meal: input.meal ?? entry.meal,
        grams: entryDecimal(next.grams),
        kcal: entryDecimal(next.kcal),
        protein: entryDecimal(next.protein),
        fat: entryDecimal(next.fat),
        carbs: entryDecimal(next.carbs),
      };
      if (input.saveAsMyProduct) {
        const per100 = foodPer100gSchema.safeParse({
          kcalPer100g: per100gFromSnapshot(next.kcal, next.grams).toNumber(),
          proteinPer100g: per100gFromSnapshot(
            next.protein,
            next.grams,
          ).toNumber(),
          fatPer100g: per100gFromSnapshot(next.fat, next.grams).toNumber(),
          carbsPer100g: per100gFromSnapshot(next.carbs, next.grams).toNumber(),
        });
        if (!per100.success) throw valuesOutOfRange();
        const copy = await this.catalog.copyFromEntry(
          userId,
          {
            name: entry.productName,
            imageUrl: entry.imageUrl,
            basedOnProductId: entry.productId,
            kcalPer100g: roundHalfUp(per100.data.kcalPer100g, 2),
            proteinPer100g: roundHalfUp(per100.data.proteinPer100g, 2),
            fatPer100g: roundHalfUp(per100.data.fatPer100g, 2),
            carbsPer100g: roundHalfUp(per100.data.carbsPer100g, 2),
          },
          db,
        );
        data.productId = copy.id;
      }
      const saved = await this.entries.updateOwned(userId, entryId, data, db);
      if (!saved) throw entryNotFound();
      return toEntry(saved);
    });
  }

  async remove(userId: string, entryId: string): Promise<void> {
    const count = await this.entries.deleteOwned(userId, entryId);
    if (count !== 1) throw entryNotFound();
  }
}

function remaining(
  target: ActiveNutritionTarget,
  totals: {
    kcal: Prisma.Decimal;
    protein: Prisma.Decimal;
    fat: Prisma.Decimal;
    carbs: Prisma.Decimal;
  },
): FoodMacroTotal {
  return {
    kcal: new Prisma.Decimal(target.targetCalories)
      .minus(totals.kcal)
      .toNumber(),
    protein: new Prisma.Decimal(target.proteinGrams)
      .minus(totals.protein)
      .toNumber(),
    fat: new Prisma.Decimal(target.fatGrams).minus(totals.fat).toNumber(),
    carbs: new Prisma.Decimal(target.carbsGrams).minus(totals.carbs).toNumber(),
  };
}

function toEntry(row: FoodLogEntry): FoodLogEntryResponse {
  return {
    id: row.id,
    productId: row.productId,
    loggedOn: formatCalendarDate(row.loggedOn),
    meal: row.meal,
    grams: row.grams.toNumber(),
    productName: row.productName,
    imageUrl: row.imageUrl,
    kcal: row.kcal.toNumber(),
    protein: row.protein.toNumber(),
    fat: row.fat.toNumber(),
    carbs: row.carbs.toNumber(),
    createdAt: row.createdAt.toISOString(),
  };
}

function productNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'FOOD_PRODUCT_NOT_FOUND',
    message: 'Food product not found',
  });
}

function entryNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'FOOD_ENTRY_NOT_FOUND',
    message: 'Food entry not found',
  });
}

function valuesOutOfRange(): BadRequestException {
  return new BadRequestException({
    code: 'FOOD_VALUES_OUT_OF_RANGE',
    message: 'Food values are too large for this amount',
  });
}
