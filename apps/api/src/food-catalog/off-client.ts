import { BadGatewayException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';

const OFF_FIELDS =
  'code,product_name,product_name_uk,brands,image_front_small_url,image_url,nutriments';
const TIMEOUT_MS = 5_000;

export const OFF_CLIENT = Symbol('OFF_CLIENT');

export interface OffClient {
  search(terms: string): Promise<unknown[]>;
  barcode(code: string): Promise<unknown | null>;
}

@Injectable()
export class OpenFoodFactsClient implements OffClient {
  constructor(private readonly config: AppConfigService) {}

  async search(terms: string): Promise<unknown[]> {
    const url = new URL('/cgi/search.pl', this.config.get('OFF_BASE_URL'));
    url.searchParams.set('search_terms', terms);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '20');
    url.searchParams.set('fields', OFF_FIELDS);
    const body = await this.getJson(url);
    if (!body || typeof body !== 'object' || !('products' in body)) return [];
    return Array.isArray(body.products) ? body.products : [];
  }

  async barcode(code: string): Promise<unknown | null> {
    const url = new URL(
      `/api/v2/product/${encodeURIComponent(code)}`,
      this.config.get('OFF_BASE_URL'),
    );
    url.searchParams.set('fields', OFF_FIELDS);
    const body = await this.getJson(url);
    if (!body || typeof body !== 'object') return null;
    if ('status' in body && body.status === 0) return null;
    if (!('product' in body) || body.product == null) return null;
    return body.product;
  }

  private async getJson(url: URL): Promise<unknown> {
    const unavailable = new BadGatewayException({
      code: 'OFF_UNAVAILABLE',
      message: 'Food search is unavailable',
    });
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': this.config.get('OFF_USER_AGENT'),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw unavailable;
    }
    if (!response.ok) throw unavailable;
    try {
      return (await response.json()) as unknown;
    } catch {
      throw unavailable;
    }
  }
}
