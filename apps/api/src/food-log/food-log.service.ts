import { Injectable, NotFoundException } from '@nestjs/common';
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
import type { CreateFoodLogInput, PatchFoodLogInput } from '@repo/validation';
import { FoodCatalogService } from '../food-catalog/food-catalog.service.js';
import { toFoodProduct } from '../food-catalog/food-product.js';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { FoodLogRepository } from './food-log.repository.js';
import {
  applyFoodLogPatch,
  calendarDateToUtc,
  entryDecimal,
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
    const loggedOn = calendarDateToUtc(date);
    const [rows, totals, target] = await Promise.all([
      this.entries.listDay(userId, loggedOn),
      this.entries.sumDay(userId, loggedOn),
      this.nutrition.getActiveTarget(userId),
    ]);
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
    const entry = await this.entries.findOwned(userId, entryId);
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
    const data = {
      productId: entry.productId,
      meal: input.meal ?? entry.meal,
      grams: entryDecimal(next.grams),
      kcal: entryDecimal(next.kcal),
      protein: entryDecimal(next.protein),
      fat: entryDecimal(next.fat),
      carbs: entryDecimal(next.carbs),
    };
    if (!input.saveAsMyProduct) {
      const saved = await this.entries.updateOwned(userId, entryId, data);
      if (!saved) throw entryNotFound();
      return toEntry(saved);
    }
    return this.entries.transaction(async (db) => {
      const copy = await this.catalog.copyFromEntry(
        userId,
        {
          name: entry.productName,
          imageUrl: entry.imageUrl,
          basedOnProductId: entry.productId,
          kcalPer100g: per100gFromSnapshot(next.kcal, next.grams),
          proteinPer100g: per100gFromSnapshot(next.protein, next.grams),
          fatPer100g: per100gFromSnapshot(next.fat, next.grams),
          carbsPer100g: per100gFromSnapshot(next.carbs, next.grams),
        },
        db,
      );
      const saved = await this.entries.updateOwned(
        userId,
        entryId,
        { ...data, productId: copy.id },
        db,
      );
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
