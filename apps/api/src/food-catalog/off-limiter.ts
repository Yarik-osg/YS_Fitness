import { Injectable } from '@nestjs/common';

class TokenBucket {
  private tokens: number;
  private updatedAt = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
  ) {
    this.tokens = capacity;
  }

  take(): boolean {
    const now = Date.now();
    const elapsed = now - this.updatedAt;
    if (elapsed > 0) {
      const add = Math.floor((elapsed * this.capacity) / this.windowMs);
      if (add > 0) {
        this.tokens = Math.min(this.capacity, this.tokens + add);
        this.updatedAt = now;
      }
    }
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

@Injectable()
export class OffOutboundLimiter {
  private readonly search = new TokenBucket(10, 60_000);
  private readonly barcode = new TokenBucket(100, 60_000);

  trySearch(): boolean {
    return this.search.take();
  }

  tryBarcode(): boolean {
    return this.barcode.take();
  }
}
