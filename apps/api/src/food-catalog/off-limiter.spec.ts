import { afterEach, describe, expect, it } from 'vitest';
import { OffOutboundLimiter, type Clock } from './off-limiter.js';

class FakeClock implements Clock {
  nowValue = 0;
  now(): number {
    return this.nowValue;
  }
}

function limiter(
  clock: FakeClock,
  limits?: Partial<{
    searchPerMin: number;
    userPerMin: number;
    barcodePerMin: number;
    barcodeUserPerMin: number;
  }>,
) {
  return new OffOutboundLimiter(clock, {
    searchPerMin: 10,
    userPerMin: 3,
    barcodePerMin: 100,
    barcodeUserPerMin: 20,
    ...limits,
  });
}

describe('OffOutboundLimiter', () => {
  const limiters: OffOutboundLimiter[] = [];

  afterEach(() => {
    for (const item of limiters) item.onModuleDestroy();
    limiters.length = 0;
  });

  function create(
    clock: FakeClock,
    limits?: Partial<{
      searchPerMin: number;
      userPerMin: number;
      barcodePerMin: number;
      barcodeUserPerMin: number;
    }>,
  ) {
    const created = limiter(clock, limits);
    limiters.push(created);
    return created;
  }

  it('lets one user call out three times and keeps the rest of the process budget', () => {
    const gate = create(new FakeClock());

    expect(gate.trySearch('a')).toBe('ok');
    expect(gate.trySearch('a')).toBe('ok');
    expect(gate.trySearch('a')).toBe('ok');
    expect(gate.trySearch('a')).toBe('user_limit');
    for (let i = 0; i < 7; i += 1)
      expect(gate.trySearch(`other-${i}`)).toBe('ok');
    expect(gate.trySearch('past-global')).toBe('global_limit');
  });

  it('does not spend the process budget when the user is already at their cap', () => {
    const gate = create(new FakeClock());
    gate.trySearch('a');
    gate.trySearch('a');
    gate.trySearch('a');
    expect(gate.trySearch('a')).toBe('user_limit');
    for (let i = 0; i < 7; i += 1) expect(gate.trySearch(`b${i}`)).toBe('ok');
    expect(gate.trySearch('last')).toBe('global_limit');
  });

  it('does not spend a user allowance when the process budget is empty', () => {
    const clock = new FakeClock();
    const gate = create(clock, { searchPerMin: 10, userPerMin: 3 });
    for (let i = 0; i < 10; i += 1) {
      expect(gate.trySearch(`filler-${i}`)).toBe('ok');
    }
    expect(gate.trySearch('denied')).toBe('global_limit');
    expect(gate.trySearch('denied')).toBe('global_limit');
    expect(gate.trySearch('denied')).toBe('global_limit');
    clock.nowValue += 6_000;
    expect(gate.trySearch('denied')).toBe('ok');
  });

  it('stops the eleventh search when four users each try three', () => {
    const gate = create(new FakeClock());
    const decisions: string[] = [];
    for (let user = 0; user < 4; user += 1) {
      for (let call = 0; call < 3; call += 1) {
        decisions.push(gate.trySearch(`user-${user}`));
      }
    }
    expect(decisions.filter((decision) => decision === 'ok')).toHaveLength(10);
    expect(decisions.slice(10)).toEqual(['global_limit', 'global_limit']);
  });

  it('stops the 21st barcode for one user and still serves someone else', () => {
    const clock = new FakeClock();
    const gate = create(clock, { barcodePerMin: 100, barcodeUserPerMin: 20 });
    for (let index = 0; index < 20; index += 1) {
      expect(gate.tryBarcode('a')).toBe('ok');
    }
    expect(gate.tryBarcode('a')).toBe('user_limit');
    expect(gate.tryBarcode('other')).toBe('ok');
  });

  it('denies the 21st barcode without spending the global bucket, and the reverse', () => {
    const clock = new FakeClock();
    const gate = create(clock, { barcodePerMin: 2, barcodeUserPerMin: 2 });
    expect(gate.tryBarcode('a')).toBe('ok');
    expect(gate.tryBarcode('a')).toBe('ok');
    expect(gate.tryBarcode('a')).toBe('user_limit');
    expect(gate.tryBarcode('b')).toBe('global_limit');
    expect(gate.tryBarcode('b')).toBe('global_limit');
    clock.nowValue += 60_000;
    expect(gate.tryBarcode('b')).toBe('ok');
  });

  it('does not let a global barcode denial spend the user allowance', () => {
    const clock = new FakeClock();
    const gate = create(clock, { barcodePerMin: 1, barcodeUserPerMin: 1 });
    expect(gate.tryBarcode('a')).toBe('ok');
    expect(gate.tryBarcode('b')).toBe('global_limit');
    expect(gate.tryBarcode('b')).toBe('global_limit');
  });

  it('drops a user key after a full quiet minute', () => {
    const clock = new FakeClock();
    const gate = create(clock);
    expect(gate.trySearch('a')).toBe('ok');
    clock.nowValue += 60_000;
    expect(gate.trySearch('b')).toBe('ok');
    expect(gate.trackedUsers()).toBe(1);
  });
});
