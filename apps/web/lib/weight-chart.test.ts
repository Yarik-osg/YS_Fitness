import { describe, expect, it } from 'vitest';
import { latestMeasurement, oneLabelPerDay } from './weight-chart';

describe('latestMeasurement', () => {
  it('picks the higher id when timestamps match, even if that row is first', () => {
    const earlier = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      measuredAt: '2026-05-01T00:00:00.000Z',
    };
    const later = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      measuredAt: '2026-05-01T00:00:00.000Z',
    };
    expect(latestMeasurement([later, earlier])?.id).toBe(later.id);
  });
});

describe('oneLabelPerDay', () => {
  it('keeps a single timestamp when every point falls on the same local day', () => {
    const morning = new Date(2026, 9, 19, 8).getTime();
    const evening = new Date(2026, 9, 19, 18).getTime();
    expect(oneLabelPerDay([morning, evening])).toEqual([morning]);
  });
});
