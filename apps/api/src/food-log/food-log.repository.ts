import { Injectable } from '@nestjs/common';
import { Prisma, type FoodLogEntry, type FoodMeal } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

type Client = Prisma.TransactionClient;

export interface FoodLogWrite {
  productId: string | null;
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

  listDay(userId: string, loggedOn: Date): Promise<FoodLogEntry[]> {
    return this.prisma.foodLogEntry.findMany({
      where: { userId, loggedOn },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async sumDay(
    userId: string,
    loggedOn: Date,
  ): Promise<{
    kcal: Prisma.Decimal;
    protein: Prisma.Decimal;
    fat: Prisma.Decimal;
    carbs: Prisma.Decimal;
  }> {
    const sum = await this.prisma.foodLogEntry.aggregate({
      where: { userId, loggedOn },
      _sum: { kcal: true, protein: true, fat: true, carbs: true },
    });
    return {
      kcal: sum._sum.kcal ?? new Prisma.Decimal(0),
      protein: sum._sum.protein ?? new Prisma.Decimal(0),
      fat: sum._sum.fat ?? new Prisma.Decimal(0),
      carbs: sum._sum.carbs ?? new Prisma.Decimal(0),
    };
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

  findOwned(userId: string, id: string): Promise<FoodLogEntry | null> {
    return this.prisma.foodLogEntry.findFirst({ where: { id, userId } });
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
