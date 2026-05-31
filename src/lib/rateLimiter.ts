export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimiterOptions = {
  windowMs: number;
  max: number;
  now?: () => number;
};

/**
 * In-memory fixed-window rate limiter.
 * Suitable for a single-instance ingestion service. For multi-instance
 * deployments, place a shared edge/WAF rate limit in front as well.
 */
export class FixedWindowRateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly now: () => number;
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = Math.max(1, options.max);
    this.now = options.now ?? (() => Date.now());
  }

  check(key: string): RateLimitResult {
    const current = this.now();
    const existing = this.hits.get(key);

    if (!existing || current >= existing.resetAt) {
      const resetAt = current + this.windowMs;
      this.hits.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.max - 1, resetAt };
    }

    if (existing.count >= this.max) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    existing.count += 1;
    return { allowed: true, remaining: this.max - existing.count, resetAt: existing.resetAt };
  }

  prune(): void {
    const current = this.now();
    for (const [key, value] of this.hits.entries()) {
      if (current >= value.resetAt) {
        this.hits.delete(key);
      }
    }
  }
}
