import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { OFF_LIMIT_WINDOW_MS } from './food-search-limits.js';

export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): number;
}

@Injectable()
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

export type OffSearchDecision = 'ok' | 'user_limit' | 'global_limit';

export interface OffLimitSettings {
  searchPerMin: number;
  userPerMin: number;
  barcodePerMin: number;
  barcodeUserPerMin: number;
}

class TokenBucket {
  private tokens: number;
  private updatedAt: number;
  private touchedAt: number;

  constructor(
    private readonly clock: Clock,
    private readonly capacity: number,
    private readonly windowMs: number,
  ) {
    this.tokens = capacity;
    this.updatedAt = clock.now();
    this.touchedAt = this.updatedAt;
  }

  available(now: number): boolean {
    this.refill(now);
    return this.tokens >= 1;
  }

  take(now: number): boolean {
    this.refill(now);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    this.touchedAt = now;
    return true;
  }

  idle(now: number): boolean {
    return now - this.touchedAt >= this.windowMs;
  }

  private refill(now: number) {
    const elapsed = now - this.updatedAt;
    if (elapsed <= 0) return;
    const add = Math.floor((elapsed * this.capacity) / this.windowMs);
    if (add <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + add);
    this.updatedAt = now;
  }
}

@Injectable()
export class OffOutboundLimiter implements OnModuleDestroy {
  private readonly search: TokenBucket;
  private readonly barcode: TokenBucket;
  private readonly users = new Map<string, TokenBucket>();
  private readonly barcodeUsers = new Map<string, TokenBucket>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly clock: Clock,
    private readonly limits: OffLimitSettings,
  ) {
    this.search = new TokenBucket(
      clock,
      limits.searchPerMin,
      OFF_LIMIT_WINDOW_MS,
    );
    this.barcode = new TokenBucket(
      clock,
      limits.barcodePerMin,
      OFF_LIMIT_WINDOW_MS,
    );
    this.timer = setInterval(
      () => this.sweep(this.clock.now()),
      OFF_LIMIT_WINDOW_MS,
    );
    this.timer.unref?.();
  }

  trySearch(userId: string): OffSearchDecision {
    const now = this.clock.now();
    this.sweep(now);
    const existing = this.users.get(userId);
    const user =
      existing ??
      new TokenBucket(this.clock, this.limits.userPerMin, OFF_LIMIT_WINDOW_MS);
    if (!user.available(now)) return 'user_limit';
    if (!this.search.available(now)) return 'global_limit';
    if (!existing) this.users.set(userId, user);
    user.take(now);
    this.search.take(now);
    return 'ok';
  }

  tryBarcode(userId: string): OffSearchDecision {
    const now = this.clock.now();
    this.sweep(now);
    const existing = this.barcodeUsers.get(userId);
    const user =
      existing ??
      new TokenBucket(
        this.clock,
        this.limits.barcodeUserPerMin,
        OFF_LIMIT_WINDOW_MS,
      );
    if (!user.available(now)) return 'user_limit';
    if (!this.barcode.available(now)) return 'global_limit';
    if (!existing) this.barcodeUsers.set(userId, user);
    user.take(now);
    this.barcode.take(now);
    return 'ok';
  }

  trackedUsers(): number {
    return this.users.size;
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private sweep(now: number) {
    for (const [userId, bucket] of this.users) {
      if (bucket.idle(now)) this.users.delete(userId);
    }
    for (const [userId, bucket] of this.barcodeUsers) {
      if (bucket.idle(now)) this.barcodeUsers.delete(userId);
    }
  }
}
