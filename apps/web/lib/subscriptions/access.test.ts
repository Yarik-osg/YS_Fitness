import { describe, expect, it } from 'vitest';
import { grantsActiveAccess } from './access';

const now = new Date('2026-10-26T12:00:00.000Z');

describe('grantsActiveAccess', () => {
  it('accepts an active subscription whose period is still open', () => {
    expect(
      grantsActiveAccess(
        { status: 'ACTIVE', currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
        now,
      ),
    ).toBe(true);
  });

  it.each(['PENDING', 'EXPIRED', 'CANCELED'])(
    'rejects a %s subscription',
    (status) => {
      expect(
        grantsActiveAccess(
          { status, currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
          now,
        ),
      ).toBe(false);
    },
  );

  it('rejects an active subscription whose period has ended', () => {
    expect(
      grantsActiveAccess(
        { status: 'ACTIVE', currentPeriodEnd: '2026-10-01T00:00:00.000Z' },
        now,
      ),
    ).toBe(false);
  });
});
