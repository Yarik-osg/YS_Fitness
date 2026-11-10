import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FoodProduct } from '@prisma/client';
import type { CatalogFoodProduct } from './food-product.js';
import {
  barcodeLookupIds,
  type CreateFoodProductInput,
  type FoodSearchQuery,
} from '@repo/validation';
import { FoodCatalogRepository } from './food-catalog.repository.js';
import { foodSearchTerms, rankBySearch } from './food-search-key.js';
import { toFoodProduct } from './food-product.js';
import { OFF_CLIENT, type OffClient } from './off-client.js';
import {
  normalizeOffProduct,
  type NormalizedOffProduct,
} from './off-normalize.js';

const SEARCH_CACHE_MS = 24 * 60 * 60 * 1000;

export function barcodeCacheKey(barcode: string): string {
  return `barcode:${barcode}`;
}

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
  ): Promise<{ products: CatalogFoodProduct[]; fromCacheOnly: boolean }> {
    if (query.barcode) {
      const found = await this.barcodeProducts(userId, query.barcode);
      return {
        products: found.products.map(toFoodProduct),
        fromCacheOnly: found.fromCacheOnly,
      };
    }
    const terms = query.q ? foodSearchTerms(query.q) : undefined;
    const customs = await this.products.matchingCustom(
      userId,
      requireTerms(terms),
    );
    const off = await this.textProducts(userId, requireTerms(terms));
    return {
      products: rankBySearch(
        [...customs, ...off.products].map(toFoodProduct),
        terms ?? '',
      ),
      fromCacheOnly: off.fromCacheOnly,
    };
  }

  async listCustom(userId: string): Promise<CatalogFoodProduct[]> {
    const rows = await this.products.listCustom(userId);
    return rows.map(toFoodProduct);
  }

  async create(
    userId: string,
    input: CreateFoodProductInput,
  ): Promise<CatalogFoodProduct> {
    try {
      const created = await this.products.createCustom(userId, {
        name: input.name,
        imageUrl: input.imageUrl ?? null,
        barcode: input.barcode ?? null,
        kcalPer100g: input.kcalPer100g,
        proteinPer100g: input.proteinPer100g,
        fatPer100g: input.fatPer100g,
        carbsPer100g: input.carbsPer100g,
      });
      return toFoodProduct(created);
    } catch (error) {
      if (
        input.barcode &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'BARCODE_ALREADY_USED',
          message: 'You already have a food with this barcode',
        });
      }
      throw error;
    }
  }

  findVisible(userId: string, productId: string) {
    return this.products.findVisible(userId, productId);
  }

  findCustomByBarcode(userId: string, barcode: string) {
    return this.products.findCustomByBarcode(userId, barcode);
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
    userId: string,
    barcode: string,
  ): Promise<{ products: FoodProduct[]; fromCacheOnly: boolean }> {
    const custom = await this.products.findCustomByBarcode(userId, barcode);
    if (custom) return { products: [custom], fromCacheOnly: false };
    const cached = await this.products.findOffByExternalIds(
      barcodeLookupIds(barcode),
    );
    if (cached) return { products: [cached], fromCacheOnly: false };
    const missed = await this.products.findSearch(barcodeCacheKey(barcode));
    if (missed && Date.now() - missed.fetchedAt.getTime() < SEARCH_CACHE_MS) {
      return { products: [], fromCacheOnly: false };
    }
    let lookup: Awaited<ReturnType<OffClient['barcode']>>;
    try {
      lookup = await this.off.barcode(userId, barcode);
    } catch (error) {
      this.logger.warn(
        `Open Food Facts barcode lookup failed for ${barcode}: ${
          error instanceof Error ? error.name : 'request failed'
        }`,
      );
      return { products: [], fromCacheOnly: true };
    }
    if (lookup.status === 'skipped') {
      return { products: [], fromCacheOnly: true };
    }
    const normalized = lookup.value ? normalizeOffProduct(lookup.value) : null;
    if (!normalized) {
      await this.products.saveSearch(barcodeCacheKey(barcode), new Date());
      return { products: [], fromCacheOnly: false };
    }
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
    let lookup: Awaited<ReturnType<OffClient['search']>>;
    try {
      lookup = await this.off.search(userId, terms);
    } catch (error) {
      if (cached.length === 0) throw error;
      return { products: cached, fromCacheOnly: true };
    }
    if (lookup.status === 'skipped') {
      return { products: cached, fromCacheOnly: true };
    }
    const byCode = new Map<string, NormalizedOffProduct>();
    for (const raw of lookup.value) {
      const normalized = normalizeOffProduct(raw);
      if (normalized && !byCode.has(normalized.externalId)) {
        byCode.set(normalized.externalId, normalized);
      }
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
