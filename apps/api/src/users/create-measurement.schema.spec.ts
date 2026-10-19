import { describe, expect, it } from 'vitest';
import { createMeasurementSchema } from '@repo/validation';

describe('createMeasurementSchema', () => {
  it('accepts a number inside the shared weight bounds', () => {
    expect(createMeasurementSchema.parse({ weightKg: 70.25 })).toEqual({
      weightKg: 70.25,
    });
    expect(createMeasurementSchema.parse({ weightKg: 25 })).toEqual({
      weightKg: 25,
    });
    expect(createMeasurementSchema.parse({ weightKg: 500 })).toEqual({
      weightKg: 500,
    });
  });

  it('rejects strings, extra fields, bounds, and a third decimal', () => {
    expect(() => createMeasurementSchema.parse({ weightKg: '70.5' })).toThrow();
    expect(() =>
      createMeasurementSchema.parse({
        weightKg: 70,
        measuredAt: '2020-01-01T00:00:00.000Z',
      }),
    ).toThrow();
    expect(() => createMeasurementSchema.parse({ weightKg: 24.99 })).toThrow();
    expect(() => createMeasurementSchema.parse({ weightKg: 500.01 })).toThrow();
    expect(() => createMeasurementSchema.parse({ weightKg: 70.255 })).toThrow();
  });
});
