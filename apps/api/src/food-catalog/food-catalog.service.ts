import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { FoodProduct } from '@prisma/client';
import type {
  FoodProductResponse,
  FoodSearchResponse,
} from '@repo/shared-types';
import type { CreateFoodProductInput, FoodSearchQuery } from '@repo/validation';
import { FoodCatalogRepository } from './food-catalog.repository.js';
import { foodSearchKey } from './food-search-key.js';
import { toFoodProduct } from './food-product.js';
import { OFF_CLIENT, type OffClient } from './off-client.js';
import {
  normalizeOffProduct,
  type NormalizedOffProduct,
} from './off-normalize.js';

const SEARCH_CACHE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FoodCatalogService {
  private readonly logger = new Logger(FoodCatalogService.name);

  constructor(
    private readonly products: FoodCatalogRepository,
    @Inject(OFF_CLIENT) private readonly off: OffClient,
  ) {}

  async search(
    userId: string,
    query: FoodSearchQuery,
  ): Promise<FoodSearchResponse> {
    const terms = query.q ? foodSearchKey(query.q) : undefined;
    const customs = await this.products.matchingCustom(userId, {
      q: terms,
      barcode: query.barcode,
    });
    const off = query.barcode
      ? await this.barcodeProducts(query.barcode)
      : await this.textProducts(userId, requireTerms(terms));
    return {
      products: [...customs, ...off.products].map(toFoodProduct),
      fromCacheOnly: off.fromCacheOnly,
    };
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

  private async barcodeProducts(
    barcode: string,
  ): Promise<{ products: FoodProduct[]; fromCacheOnly: boolean }> {
    const cached = await this.products.findOffByBarcode(barcode);
    if (cached) return { products: [cached], fromCacheOnly: true };
    const lookup = await this.off.barcode(barcode);
    if (lookup.status === 'skipped')
      return { products: [], fromCacheOnly: true };
    if (lookup.value == null) return { products: [], fromCacheOnly: false };
    const normalized = normalizeOffProduct(lookup.value);
    if (!normalized) return { products: [], fromCacheOnly: false };
    const stored = await this.storeOne(normalized);
    return { products: stored ? [stored] : [], fromCacheOnly: false };
  }

  private async textProducts(
    userId: string,
    terms: string,
  ): Promise<{ products: FoodProduct[]; fromCacheOnly: boolean }> {
    const cached = await this.products.matchingOff(terms);
    const previous = await this.products.findSearch(terms);
    if (
      previous &&
      Date.now() - previous.fetchedAt.getTime() < SEARCH_CACHE_MS
    ) {
      return { products: cached, fromCacheOnly: false };
    }
    const lookup = await this.off.search(userId, terms);
    if (lookup.status === 'skipped') {
      return { products: cached, fromCacheOnly: true };
    }
    const byCode = new Map<string, NormalizedOffProduct>();
    for (const raw of lookup.value) {
      const normalized = normalizeOffProduct(raw);
      if (normalized) byCode.set(normalized.externalId, normalized);
    }
    const stored: FoodProduct[] = [];
    for (const product of byCode.values()) {
      const row = await this.storeOne(product);
      if (row) stored.push(row);
    }
    await this.products.saveSearch(terms, new Date());
    return { products: stored, fromCacheOnly: false };
  }

  private async storeOne(
    product: NormalizedOffProduct,
  ): Promise<FoodProduct | null> {
    try {
      return await this.products.upsertOff(product);
    } catch (error) {
      this.logger.warn(
        `Skipped caching Open Food Facts product ${product.externalId}: ${
          error instanceof Error ? error.name : 'write failed'
        }`,
      );
      return null;
    }
  }
}

function requireTerms(terms: string | undefined): string {
  if (terms) return terms;
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
  });
}
