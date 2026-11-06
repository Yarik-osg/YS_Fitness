import { foodPer100gSchema } from '@repo/validation';
import { roundHalfUp } from '../common/round-half-up.js';

const NAME_LIMIT = 200;
const BRAND_LIMIT = 200;
const IMAGE_LIMIT = 2000;

export interface NormalizedOffProduct {
  externalId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

export function normalizeOffProduct(raw: unknown): NormalizedOffProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name =
    text(record.product_name_uk, NAME_LIMIT) ??
    text(record.product_name, NAME_LIMIT);
  const externalId = code(record.code);
  const kcal = nutrient(record.nutriments, 'energy-kcal_100g');
  if (!name || !externalId || kcal === 'missing' || kcal === 'invalid') {
    return null;
  }

  const protein = nutrient(record.nutriments, 'proteins_100g');
  const fat = nutrient(record.nutriments, 'fat_100g');
  const carbs = nutrient(record.nutriments, 'carbohydrates_100g');
  if (protein === 'invalid' || fat === 'invalid' || carbs === 'invalid') {
    return null;
  }

  const candidate = {
    kcalPer100g: roundHalfUp(kcal, 2).toNumber(),
    proteinPer100g:
      protein === 'missing' ? 0 : roundHalfUp(protein, 2).toNumber(),
    fatPer100g: fat === 'missing' ? 0 : roundHalfUp(fat, 2).toNumber(),
    carbsPer100g: carbs === 'missing' ? 0 : roundHalfUp(carbs, 2).toNumber(),
  };
  const parsed = foodPer100gSchema.safeParse(candidate);
  if (!parsed.success) return null;

  return {
    externalId,
    name,
    brand: text(record.brands, BRAND_LIMIT),
    imageUrl:
      text(record.image_front_small_url, IMAGE_LIMIT) ??
      text(record.image_url, IMAGE_LIMIT),
    ...parsed.data,
  };
}

function code(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value).slice(0, 32);
  }
  return text(value, 32);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function nutrient(
  source: unknown,
  key: string,
): number | 'missing' | 'invalid' {
  if (!source || typeof source !== 'object') return 'missing';
  const value = (source as Record<string, unknown>)[key];
  if (value === undefined || value === null || value === '') return 'missing';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return 'invalid';
  return number;
}
