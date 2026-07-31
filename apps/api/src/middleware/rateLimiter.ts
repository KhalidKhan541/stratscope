/**
 * Rate limiter middleware using Cloudflare KV.
 *
 * Implements a sliding window rate limiter that stores counters in KV.
 * Each client (by IP or API key) gets a configurable number of requests
 * per time window.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env";

interface RateLimitConfig {
  readonly windowSeconds: number;
  readonly maxRequests: number;
  readonly keyPrefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 100,
  keyPrefix: "rl",
};

export function rateLimiter(config?: Partial<RateLimitConfig>): (
  c: Context,
  next: Next
) => Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return async (c: Context, next: Next): Promise<void> => {
    const env = (c as unknown as { env: Env }).env;
    const clientIp = c.req.header("CF-Connecting-IP") ?? "unknown";
    const apiKey = c.req.header("Authorization")?.replace("Bearer ", "") ?? null;
    const identifier = apiKey ?? clientIp;
    const windowKey = Math.floor(Date.now() / (cfg.windowSeconds * 1000));
    const key = `${cfg.keyPrefix}:${identifier}:${windowKey}`;

    const current = await env.KV.get(key, "text");
    const count = current ? parseInt(current, 10) : 0;

    if (count >= cfg.maxRequests) {
      const retryAfter = cfg.windowSeconds;
      c.header("X-RateLimit-Limit", String(cfg.maxRequests));
      c.header("X-RateLimit-Remaining", "0");
      c.header("Retry-After", String(retryAfter));

      c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: `Rate limited. Retry after ${retryAfter}s`,
            retryAfterSeconds: retryAfter,
          },
        },
        429
      );
      return;
    }

    await env.KV.put(key, String(count + 1), {
      expirationTtl: cfg.windowSeconds * 2,
    });

    c.header("X-RateLimit-Limit", String(cfg.maxRequests));
    c.header("X-RateLimit-Remaining", String(cfg.maxRequests - count - 1));

    await next();
  };
}
