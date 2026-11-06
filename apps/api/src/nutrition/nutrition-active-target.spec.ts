import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { NutritionService } from './nutrition.service.js';

describe('NutritionService.getActiveTarget', () => {
  it('returns the active target as numbers, or null when none is active', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        source: 'MANUAL',
        targetCalories: new Prisma.Decimal('1800.5'),
        proteinGrams: new Prisma.Decimal(120),
        fatGrams: new Prisma.Decimal(50),
        carbsGrams: new Prisma.Decimal(180),
      })
      .mockResolvedValueOnce(null);
    const service = new NutritionService({
      nutritionTarget: { findFirst },
    } as never);

    await expect(service.getActiveTarget('user-1')).resolves.toEqual({
      source: 'MANUAL',
      targetCalories: 1800.5,
      proteinGrams: 120,
      fatGrams: 50,
      carbsGrams: 180,
    });
    await expect(service.getActiveTarget('user-1')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', active: true },
      select: {
        source: true,
        targetCalories: true,
        proteinGrams: true,
        fatGrams: true,
        carbsGrams: true,
      },
    });
  });
});
