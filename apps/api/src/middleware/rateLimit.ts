/**
 * Rate limiting middleware using Cloudflare KV.
 *
 * Implements a sliding window counter per API key.
 * Limits are configurable per-route via options.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env.js";

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. */
  readonly maxRequests: number;
  /** Window duration in seconds. */
  readonly windowSeconds: number;
  /** Custom key prefix for the rate limit bucket. */
  readonly keyPrefix?: string;
}

/**
 * Rate limit check result.
 */
interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
}

/**
 * Checks rate limit using a sliding window counter in KV.
 */
async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - options.windowSeconds;

  const counterKey = `${key}:${Math.floor(now / options.windowSeconds)}`;
  const prevCounterKey = `${key}:${Math.floor((now - 1) / options.windowSeconds)}`;

  const [currentCount, prevCount] = await Promise.all([
    kv.get<number>(counterKey, "json"),
    kv.get<number>(prevCounterKey, "json"),
  ]);

  const current = currentCount ?? 0;
  const prev = prevCount ?? 0;

  // Sliding window approximation
  const elapsed = now % options.windowSeconds;
  const weight = 1 - elapsed / options.windowSeconds;
  const estimatedCount = Math.floor(prev * weight + current);

  if (estimatedCount >= options.maxRequests) {
    const resetAt = (Math.floor(now / options.windowSeconds) + 1) * options.windowSeconds;
    return {
      allowed: false,
      limit: options.maxRequests,
      remaining: 0,
      resetAt,
    };
  }

  // Increment counter
  await kv.put(counterKey, String(current + 1), {
    expirationTtl: options.windowSeconds * 2,
  });

  const resetAt = (Math.floor(now / options.windowSeconds) + 1) * options.windowSeconds;
  return {
    allowed: true,
    limit: options.maxRequests,
    remaining: options.maxRequests - estimatedCount - 1,
    resetAt,
  };
}

/**
 * Creates a rate limiting middleware with the given options.
 *
 * @example
 * ```ts
 * const limiter = rateLimit({
 *   maxRequests: 100,
 *   windowSeconds: 60,
 * });
 *
 * app.use("/v1/executions", limiter);
 * ```
 */
export function rateLimit(options: RateLimitOptions) {
  const keyPrefix = options.keyPrefix ?? "rl";

  return async (c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> => {
    if (!c.env.KV) {
      await next();
      return;
    }

    const auth = (c as unknown as { get(key: string): unknown }).get("auth") as { apiKeyId?: string } | undefined;
    const apiKeyId = auth?.apiKeyId ?? "anonymous";
    const key = `${keyPrefix}:${apiKeyId}`;

    const result = await checkRateLimit(c.env.KV, key, options);

    c.header("X-RateLimit-Limit", String(result.limit));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(result.resetAt));

    if (!result.allowed) {
      c.header("Retry-After", String(result.resetAt - Math.floor(Date.now() / 1000)));
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded. Retry after ${result.resetAt - Math.floor(Date.now() / 1000)}s`,
          },
        },
        429
      );
    }

    await next();
  };
}

/** Default rate limit for general API endpoints. */
export const defaultRateLimit = rateLimit({
  maxRequests: 100,
  windowSeconds: 60,
});

/** Strict rate limit for write-heavy endpoints. */
export const writeRateLimit = rateLimit({
  maxRequests: 30,
  windowSeconds: 60,
  keyPrefix: "rl:write",
});
