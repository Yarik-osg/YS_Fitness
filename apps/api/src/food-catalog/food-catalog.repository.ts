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

  matchingCustom(
    userId: string,
    query: { q?: string; barcode?: string },
  ): Promise<FoodProduct[]> {
    return this.prisma.foodProduct.findMany({
      where: {
        source: 'CUSTOM',
        ownerId: userId,
        OR: matchQuery(query),
      },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  matchingOff(terms: string): Promise<FoodProduct[]> {
    return this.prisma.foodProduct.findMany({
      where: { source: 'OFF', OR: matchQuery({ q: terms }) },
      orderBy: { name: 'asc' },
      take: 20,
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

  copyFromEntry(
    userId: string,
    input: {
      name: string;
      imageUrl: string | null;
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

function matchQuery(query: { q?: string; barcode?: string }) {
  const matches: Prisma.FoodProductWhereInput[] = [];
  if (query.q) {
    matches.push(
      { name: { contains: query.q, mode: 'insensitive' } },
      { brand: { contains: query.q, mode: 'insensitive' } },
    );
  }
  if (query.barcode) matches.push({ externalId: query.barcode });
  return matches;
}
