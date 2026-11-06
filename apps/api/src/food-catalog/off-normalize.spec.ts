import { describe, expect, it } from 'vitest';
import { normalizeOffProduct } from './off-normalize.js';

const milk = {
  code: '4820001234567',
  product_name: 'Milk',
  product_name_uk: 'Молоко',
  brands: 'Farm',
  image_front_small_url: 'https://images.example/small.jpg',
  image_url: 'https://images.example/full.jpg',
  nutriments: {
    'energy-kcal_100g': 46.126,
    proteins_100g: '3.4',
    fat_100g: 1,
    carbohydrates_100g: 4.8,
  },
};

describe('normalizeOffProduct', () => {
  it('prefers the Ukrainian name and rounds nutrients to 2 decimals', () => {
    expect(normalizeOffProduct(milk)).toEqual({
      externalId: '4820001234567',
      name: 'Молоко',
      brand: 'Farm',
      imageUrl: 'https://images.example/small.jpg',
      kcalPer100g: 46.13,
      proteinPer100g: 3.4,
      fatPer100g: 1,
      carbsPer100g: 4.8,
    });
  });

  it('falls back to product_name and treats a missing macro as zero', () => {
    expect(
      normalizeOffProduct({
        code: '1234',
        product_name: '  Rice  ',
        product_name_uk: '   ',
        nutriments: { 'energy-kcal_100g': 130 },
      }),
    ).toMatchObject({
      name: 'Rice',
      brand: null,
      imageUrl: null,
      proteinPer100g: 0,
      fatPer100g: 0,
      carbsPer100g: 0,
    });
  });

  it('drops a product without a name, a code, or kcal', () => {
    expect(
      normalizeOffProduct({ code: '1', nutriments: { 'energy-kcal_100g': 1 } }),
    ).toBeNull();
    expect(
      normalizeOffProduct({
        product_name: 'Bread',
        nutriments: { 'energy-kcal_100g': 1 },
      }),
    ).toBeNull();
    expect(
      normalizeOffProduct({
        code: '1',
        product_name: 'Bread',
        nutriments: { proteins_100g: 1 },
      }),
    ).toBeNull();
    expect(normalizeOffProduct(null)).toBeNull();
    expect(
      normalizeOffProduct({ code: '1', product_name: 'Bread' }),
    ).toBeNull();
  });

  it('drops a product whose kcal or macros are above the shared caps', () => {
    expect(
      normalizeOffProduct({
        code: '1',
        product_name: 'Absurd',
        nutriments: {
          'energy-kcal_100g': 1e7,
          proteins_100g: 1,
          fat_100g: 1,
          carbohydrates_100g: 1,
        },
      }),
    ).toBeNull();
    expect(
      normalizeOffProduct({
        code: '2',
        product_name: 'Dense',
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 101,
          fat_100g: 1,
          carbohydrates_100g: 1,
        },
      }),
    ).toBeNull();
  });

  it('drops a product with a negative or non-numeric nutrient', () => {
    expect(
      normalizeOffProduct({
        code: '1',
        product_name: 'Bread',
        nutriments: { 'energy-kcal_100g': -1 },
      }),
    ).toBeNull();
    expect(
      normalizeOffProduct({
        code: '1',
        product_name: 'Bread',
        nutriments: { 'energy-kcal_100g': 10, proteins_100g: 'nope' },
      }),
    ).toBeNull();
  });
});
