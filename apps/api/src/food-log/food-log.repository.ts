import { Injectable } from '@nestjs/common';
import { Prisma, type FoodLogEntry, type FoodMeal } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

type Client = Prisma.TransactionClient;

export interface RecentFoodRow {
  productId: string;
  grams: Prisma.Decimal;
  meal: FoodMeal;
  loggedOn: Date;
  source: 'OFF' | 'CUSTOM';
  externalId: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  kcalPer100g: Prisma.Decimal;
  proteinPer100g: Prisma.Decimal;
  fatPer100g: Prisma.Decimal;
  carbsPer100g: Prisma.Decimal;
}

export interface FoodLogWrite {
  productId: string | null;
  productName?: string;
  meal: FoodMeal;
  grams: Prisma.Decimal;
  kcal: Prisma.Decimal;
  protein: Prisma.Decimal;
  fat: Prisma.Decimal;
  carbs: Prisma.Decimal;
}

@Injectable()
export class FoodLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  listFavorites(userId: string): Promise<{ productId: string }[]> {
    return this.prisma.favoriteFood.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
    });
  }

  async favorite(userId: string, productId: string): Promise<void> {
    await this.prisma.favoriteFood.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
  }

  async unfavorite(userId: string, productId: string): Promise<void> {
    await this.prisma.favoriteFood.deleteMany({ where: { userId, productId } });
  }

  async favoriteIdSet(
    userId: string,
    productIds: string[],
  ): Promise<Set<string>> {
    if (productIds.length === 0) return new Set();
    const rows = await this.prisma.favoriteFood.findMany({
      where: { userId, productId: { in: productIds } },
      select: { productId: true },
    });
    return new Set(rows.map((row) => row.productId));
  }

  recent(userId: string, limit: number): Promise<RecentFoodRow[]> {
    return this.prisma.$queryRaw<RecentFoodRow[]>`
      SELECT
        picked.product_id AS "productId",
        picked.grams,
        picked.meal,
        picked.logged_on AS "loggedOn",
        picked.source,
        picked.external_id AS "externalId",
        picked.barcode AS "barcode",
        picked.name,
        picked.brand,
        picked.image_url AS "imageUrl",
        picked.kcal_per_100g AS "kcalPer100g",
        picked.protein_per_100g AS "proteinPer100g",
        picked.fat_per_100g AS "fatPer100g",
        picked.carbs_per_100g AS "carbsPer100g"
      FROM (
        SELECT DISTINCT ON (e.product_id)
          e.product_id,
          e.grams,
          e.meal,
          e.logged_on,
          e.created_at,
          e.id,
          p.source,
          p.external_id,
          p.barcode,
          p.name,
          p.brand,
          p.image_url,
          p.kcal_per_100g,
          p.protein_per_100g,
          p.fat_per_100g,
          p.carbs_per_100g
        FROM food_log_entries e
        INNER JOIN food_products p ON p.id = e.product_id
        WHERE e.user_id = CAST(${userId} AS uuid)
          AND e.product_id IS NOT NULL
          AND (
            p.source = 'OFF'
            OR (
              p.source = 'CUSTOM'
              AND p.owner_id = CAST(${userId} AS uuid)
            )
          )
        ORDER BY e.product_id, e.created_at DESC, e.id DESC
      ) picked
      ORDER BY picked.created_at DESC, picked.id DESC
      LIMIT ${limit}
    `;
  }

  listDay(userId: string, loggedOn: Date): Promise<FoodLogEntry[]> {
    return this.prisma.foodLogEntry.findMany({
      where: { userId, loggedOn },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  create(data: {
    userId: string;
    productId: string;
    loggedOn: Date;
    meal: FoodMeal;
    grams: Prisma.Decimal;
    productName: string;
    imageUrl: string | null;
    kcal: Prisma.Decimal;
    protein: Prisma.Decimal;
    fat: Prisma.Decimal;
    carbs: Prisma.Decimal;
  }): Promise<FoodLogEntry> {
    return this.prisma.foodLogEntry.create({ data });
  }

  async lockOwned(
    userId: string,
    id: string,
    client: Client,
  ): Promise<FoodLogEntry | null> {
    const locked = await client.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM food_log_entries
      WHERE id = CAST(${id} AS uuid)
        AND user_id = CAST(${userId} AS uuid)
      FOR UPDATE
    `;
    if (locked.length !== 1) return null;
    return client.foodLogEntry.findFirst({ where: { id, userId } });
  }

  async updateOwned(
    userId: string,
    id: string,
    data: FoodLogWrite,
    client: Client = this.prisma,
  ): Promise<FoodLogEntry | null> {
    const result = await client.foodLogEntry.updateMany({
      where: { id, userId },
      data,
    });
    if (result.count !== 1) return null;
    return client.foodLogEntry.findFirst({ where: { id } });
  }

  async deleteOwned(userId: string, id: string): Promise<number> {
    const result = await this.prisma.foodLogEntry.deleteMany({
      where: { id, userId },
    });
    return result.count;
  }
}
