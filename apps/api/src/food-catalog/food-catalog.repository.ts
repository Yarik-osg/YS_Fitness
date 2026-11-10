import { Injectable } from '@nestjs/common';
import { Prisma, type FoodProduct } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NormalizedOffProduct } from './off-normalize.js';

type Client = Prisma.TransactionClient;

const visibleTo = (userId: string) => ({
  OR: [
    { source: 'OFF' as const },
    { source: 'CUSTOM' as const, ownerId: userId },
  ],
});

@Injectable()
export class FoodCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  matchingCustom(userId: string, terms?: string): Promise<FoodProduct[]> {
    return this.prisma.foodProduct.findMany({
      where: {
        source: 'CUSTOM',
        ownerId: userId,
        OR: matchQuery(terms),
      },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  findCustomByBarcode(
    userId: string,
    barcode: string,
  ): Promise<FoodProduct | null> {
    return this.prisma.foodProduct.findFirst({
      where: { source: 'CUSTOM', ownerId: userId, barcode },
    });
  }

  async findOffByExternalIds(ids: string[]): Promise<FoodProduct | null> {
    if (ids.length === 0) return null;
    const rows = await this.prisma.foodProduct.findMany({
      where: { source: 'OFF', externalId: { in: ids } },
    });
    return rows.find((row) => row.externalId === ids[0]) ?? rows[0] ?? null;
  }

  listCustom(userId: string): Promise<FoodProduct[]> {
    return this.prisma.foodProduct.findMany({
      where: { source: 'CUSTOM', ownerId: userId },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  matchingOff(terms: string): Promise<FoodProduct[]> {
    return this.prisma.foodProduct.findMany({
      where: { source: 'OFF', OR: matchQuery(terms) },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  findSearch(queryKey: string): Promise<{ fetchedAt: Date } | null> {
    return this.prisma.foodSearchQuery.findUnique({
      where: { queryKey },
      select: { fetchedAt: true },
    });
  }

  saveSearch(queryKey: string, fetchedAt: Date): Promise<unknown> {
    return this.prisma.foodSearchQuery.upsert({
      where: { queryKey },
      create: { queryKey, fetchedAt },
      update: { fetchedAt },
    });
  }

  findOffByBarcode(barcode: string): Promise<FoodProduct | null> {
    return this.prisma.foodProduct.findFirst({
      where: { source: 'OFF', externalId: barcode },
    });
  }

  async upsertOff(product: NormalizedOffProduct): Promise<FoodProduct> {
    const data = {
      name: product.name,
      brand: product.brand,
      imageUrl: product.imageUrl,
      kcalPer100g: product.kcalPer100g,
      proteinPer100g: product.proteinPer100g,
      fatPer100g: product.fatPer100g,
      carbsPer100g: product.carbsPer100g,
    };
    try {
      return await this.prisma.foodProduct.upsert({
        where: {
          source_externalId: { source: 'OFF', externalId: product.externalId },
        },
        create: {
          source: 'OFF',
          externalId: product.externalId,
          ownerId: null,
          ...data,
        },
        // A later OFF fetch refreshes the cache. A log edit never writes this row.
        update: data,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const existing = await this.findOffByBarcode(product.externalId);
      if (!existing) throw error;
      return existing;
    }
  }

  createCustom(
    userId: string,
    input: {
      name: string;
      imageUrl: string | null;
      barcode: string | null;
      kcalPer100g: number;
      proteinPer100g: number;
      fatPer100g: number;
      carbsPer100g: number;
    },
  ): Promise<FoodProduct> {
    return this.prisma.foodProduct.create({
      data: { source: 'CUSTOM', ownerId: userId, externalId: null, ...input },
    });
  }

  findVisible(userId: string, productId: string): Promise<FoodProduct | null> {
    return this.prisma.foodProduct.findFirst({
      where: { id: productId, ...visibleTo(userId) },
    });
  }

  findVisibleByIds(userId: string, ids: string[]): Promise<FoodProduct[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.foodProduct.findMany({
      where: { id: { in: ids }, ...visibleTo(userId) },
    });
  }

  async copyFromEntry(
    userId: string,
    input: {
      name: string;
      imageUrl: string | null;
      barcode: string | null;
      basedOnProductId: string | null;
      kcalPer100g: Prisma.Decimal;
      proteinPer100g: Prisma.Decimal;
      fatPer100g: Prisma.Decimal;
      carbsPer100g: Prisma.Decimal;
    },
    db: Client,
  ): Promise<{ id: string }> {
    try {
      return await this.insertCopy(userId, input, db);
    } catch (error) {
      if (!input.barcode || !isUniqueViolation(error)) throw error;
      return this.insertCopy(userId, { ...input, barcode: null }, db);
    }
  }

  private insertCopy(
    userId: string,
    input: {
      name: string;
      imageUrl: string | null;
      barcode: string | null;
      basedOnProductId: string | null;
      kcalPer100g: Prisma.Decimal;
      proteinPer100g: Prisma.Decimal;
      fatPer100g: Prisma.Decimal;
      carbsPer100g: Prisma.Decimal;
    },
    db: Client,
  ): Promise<{ id: string }> {
    return db.foodProduct.create({
      data: {
        source: 'CUSTOM',
        ownerId: userId,
        externalId: null,
        ...input,
      },
      select: { id: true },
    });
  }
}

function matchQuery(terms?: string) {
  const matches: Prisma.FoodProductWhereInput[] = [];
  if (terms) {
    matches.push(fieldContainsTokens('name', terms));
    matches.push(fieldContainsTokens('brand', terms));
  }
  return matches;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function fieldContainsTokens(
  field: 'name' | 'brand',
  terms: string,
): Prisma.FoodProductWhereInput {
  return {
    AND: terms
      .split(' ')
      .filter((token) => token.length > 0)
      .map((token) => ({
        [field]: { contains: token, mode: 'insensitive' as const },
      })),
  };
}
