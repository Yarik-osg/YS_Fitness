import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { FoodProduct } from '@prisma/client';
import type {
  FoodProductListResponse,
  FoodProductResponse,
} from '@repo/shared-types';
import type { CreateFoodProductInput, FoodSearchQuery } from '@repo/validation';
import { FoodCatalogRepository } from './food-catalog.repository.js';
import { toFoodProduct } from './food-product.js';
import { OFF_CLIENT, type OffClient } from './off-client.js';
import { normalizeOffProduct } from './off-normalize.js';

@Injectable()
export class FoodCatalogService {
  constructor(
    private readonly products: FoodCatalogRepository,
    @Inject(OFF_CLIENT) private readonly off: OffClient,
  ) {}

  async search(
    userId: string,
    query: FoodSearchQuery,
  ): Promise<FoodProductListResponse> {
    const customs = await this.products.matchingCustom(userId, query);
    const off = query.barcode
      ? await this.barcodeProducts(query.barcode)
      : await this.textProducts(requireTerms(query.q));
    return { products: [...customs, ...off].map(toFoodProduct) };
  }

  async create(
    userId: string,
    input: CreateFoodProductInput,
  ): Promise<FoodProductResponse> {
    const created = await this.products.createCustom(userId, {
      name: input.name,
      imageUrl: input.imageUrl ?? null,
      kcalPer100g: input.kcalPer100g,
      proteinPer100g: input.proteinPer100g,
      fatPer100g: input.fatPer100g,
      carbsPer100g: input.carbsPer100g,
    });
    return toFoodProduct(created);
  }

  findVisible(userId: string, productId: string) {
    return this.products.findVisible(userId, productId);
  }

  findVisibleByIds(userId: string, ids: string[]) {
    return this.products.findVisibleByIds(userId, ids);
  }

  copyFromEntry(
    ...args: Parameters<FoodCatalogRepository['copyFromEntry']>
  ): ReturnType<FoodCatalogRepository['copyFromEntry']> {
    return this.products.copyFromEntry(...args);
  }

  private async barcodeProducts(barcode: string): Promise<FoodProduct[]> {
    const cached = await this.products.findOffByBarcode(barcode);
    if (cached) return [cached];
    const raw = await this.off.barcode(barcode);
    if (raw == null) return [];
    const normalized = normalizeOffProduct(raw);
    if (!normalized) return [];
    return [await this.products.upsertOff(normalized)];
  }

  private async textProducts(terms: string): Promise<FoodProduct[]> {
    const cached = await this.products.matchingOff(terms);
    if (cached.length > 0) return cached;
    const raws = await this.off.search(terms);
    const byCode = new Map<string, ReturnType<typeof normalizeOffProduct>>();
    for (const raw of raws) {
      const normalized = normalizeOffProduct(raw);
      if (normalized) byCode.set(normalized.externalId, normalized);
    }
    const stored: FoodProduct[] = [];
    for (const product of byCode.values()) {
      if (product) stored.push(await this.products.upsertOff(product));
    }
    return stored;
  }
}

function requireTerms(terms: string | undefined): string {
  if (terms) return terms;
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
  });
}
