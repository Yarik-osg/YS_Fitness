import { nutritionProfileSchema } from '@repo/validation';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubscriptionGuard } from '../subscriptions/subscription.guard.js';
import { NutritionProfileDto } from './dto/nutrition-profile.dto.js';
import { NutritionController } from './nutrition.controller.js';

const GUARDS_METADATA = '__guards__';

describe('NutritionController', () => {
  it('requires a subscription on every client route and a JWT first', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, NutritionController)).toEqual([
      JwtAuthGuard,
    ]);
    for (const method of [
      NutritionController.prototype.getProfile,
      NutritionController.prototype.saveProfile,
      NutritionController.prototype.listCalculations,
      NutritionController.prototype.calculate,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
        SubscriptionGuard,
      ]);
    }
  });

  it('passes only the signed-in user to the service', async () => {
    const calls: string[] = [];
    const nutrition = {
      getProfile: async (userId: string) => {
        calls.push(userId);
        return { profile: null };
      },
      saveProfile: async (userId: string) => {
        calls.push(userId);
        return {};
      },
      listCalculations: async (userId: string) => {
        calls.push(userId);
        return { calculations: [] };
      },
      calculate: async (userId: string) => {
        calls.push(userId);
        return {};
      },
    };
    const controller = new NutritionController(nutrition as never);
    const user = {
      sub: 'client-a',
      sessionId: 'session',
      role: 'CLIENT' as const,
    };

    await controller.getProfile(user);
    await controller.saveProfile(user, {} as never);
    await controller.listCalculations(user);
    await controller.calculate(user);

    expect(calls).toEqual(['client-a', 'client-a', 'client-a', 'client-a']);
    expect(NutritionProfileDto.schema).toBe(nutritionProfileSchema);
  });
});
