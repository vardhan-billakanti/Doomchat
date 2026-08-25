// ─────────────────────────────────────────────────────────────────────────────
// Token-bucket rate limiter per WebSocket connection
// Prevents message flooding from individual connections
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum tokens in the bucket */
  maxTokens: number;
  /** How many ms it takes to refill one token */
  refillIntervalMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxTokens: 8,
  refillIntervalMs: 1000, // 1 token per second → burst of 8, then 1/s
};

export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config;
    this.tokens = config.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /** Returns true if the action is allowed, false if rate limited */
  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Returns milliseconds until next token is available */
  msUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return this.config.refillIntervalMs - (Date.now() - this.lastRefillTime);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsed / this.config.refillIntervalMs);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }
}
