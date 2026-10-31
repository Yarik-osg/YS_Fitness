import { describe, expect, it, vi } from 'vitest';
import {
  NUTRITION_ONE_ACTIVE_TARGET_INDEX,
  NutritionIndexCheck,
  isOneActiveTargetIndex,
  type NutritionActiveTargetIndex,
} from './nutrition-index.check.js';

const correct: NutritionActiveTargetIndex = {
  tableName: 'nutrition_targets',
  unique: true,
  keyColumns: ['user_id'],
  predicate: 'active',
};

function checkWith(rows: NutritionActiveTargetIndex[]) {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
  return new NutritionIndexCheck(prisma as never);
}

describe('isOneActiveTargetIndex', () => {
  it('accepts the catalog row for the active-target index', () => {
    expect(isOneActiveTargetIndex(correct)).toBe(true);
    expect(
      isOneActiveTargetIndex({ ...correct, predicate: '( "active" = TRUE )' }),
    ).toBe(true);
    expect(
      isOneActiveTargetIndex({ ...correct, predicate: 'active IS TRUE' }),
    ).toBe(true);
  });

  it('rejects a non-unique index', () => {
    expect(isOneActiveTargetIndex({ ...correct, unique: false })).toBe(false);
  });

  it('rejects an index on another table', () => {
    expect(
      isOneActiveTargetIndex({ ...correct, tableName: 'subscriptions' }),
    ).toBe(false);
  });

  it('rejects a different key column', () => {
    expect(isOneActiveTargetIndex({ ...correct, keyColumns: ['source'] })).toBe(
      false,
    );
  });

  it('rejects extra key columns', () => {
    expect(
      isOneActiveTargetIndex({
        ...correct,
        keyColumns: ['user_id', 'source'],
      }),
    ).toBe(false);
  });

  it('rejects active = false', () => {
    expect(
      isOneActiveTargetIndex({ ...correct, predicate: 'active = false' }),
    ).toBe(false);
    expect(
      isOneActiveTargetIndex({ ...correct, predicate: 'NOT active' }),
    ).toBe(false);
  });

  it('rejects a missing or different predicate', () => {
    expect(isOneActiveTargetIndex({ ...correct, predicate: null })).toBe(false);
    expect(
      isOneActiveTargetIndex({
        ...correct,
        predicate: 'active = true AND true',
      }),
    ).toBe(false);
  });
});

describe('NutritionIndexCheck', () => {
  it('refuses to boot when the index is missing', async () => {
    await expect(checkWith([]).onApplicationBootstrap()).rejects.toThrow(
      `Missing partial unique index ${NUTRITION_ONE_ACTIVE_TARGET_INDEX}`,
    );
  });

  it('refuses to boot when the catalog row is not the required index', async () => {
    await expect(
      checkWith([
        { ...correct, predicate: 'active = false' },
      ]).onApplicationBootstrap(),
    ).rejects.toThrow(
      `Index ${NUTRITION_ONE_ACTIVE_TARGET_INDEX} must be a unique index`,
    );
  });

  it('boots when the catalog row matches', async () => {
    await expect(
      checkWith([correct]).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });
});
