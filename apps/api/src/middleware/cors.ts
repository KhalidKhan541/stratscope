/**
 * CORS middleware for Hono.
 *
 * Configures cross-origin resource sharing headers for the API.
 * In development, allows all origins. In production, restricts to the
 * configured APP_URL.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env";

export async function corsMiddleware(c: Context, next: Next): Promise<void> {
  const env = (c as unknown as { env: Env }).env;
  const origin =
    env.ENVIRONMENT === "development"
      ? "*"
      : env.APP_URL ?? "https://stratscope.ai";

  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID, X-Execution-ID");
  c.header("Access-Control-Expose-Headers", "X-Request-ID, X-RateLimit-Remaining, X-RateLimit-Limit");
  c.header("Access-Control-Max-Age", "86400");

  if (c.req.method === "OPTIONS") {
    c.text("", 204 as any);
    return;
  }

  await next();
}
