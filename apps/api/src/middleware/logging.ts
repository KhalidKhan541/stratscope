/**
 * Request logging middleware for Hono.
 *
 * Logs all incoming requests with structured JSON, including
 * method, path, status, duration, and request ID.
 */

import type { Context, Next } from "hono";
import type { Env } from "../workers/env";

export async function loggingMiddleware(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const requestId = c.req.header("X-Request-ID") ?? "unknown";
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  const env = (c as unknown as { env: Env }).env;
  const logLevel = env.LOG_LEVEL ?? "info";

  const logEntry = {
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    message: "request_completed",
    service: "api",
    timestamp: new Date().toISOString(),
    requestId,
    method,
    path,
    status,
    duration,
  };

  if (logLevel === "debug" || status >= 400) {
    console.log(JSON.stringify(logEntry));
  } else if (status < 400) {
    console.log(JSON.stringify(logEntry));
  }
}
