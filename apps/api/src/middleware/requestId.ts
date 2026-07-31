/**
 * Request ID generation middleware for Hono.
 *
 * Generates a unique request ID for every incoming request and attaches
 * it to the response headers. If the client provides an X-Request-ID header,
 * it is used instead to enable distributed tracing.
 */

import type { Context, Next } from "hono";

export async function requestIdMiddleware(c: Context, next: Next): Promise<void> {
  const existingId = c.req.header("X-Request-ID");
  const requestId = existingId ?? generateRequestId();

  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  await next();
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

export function getRequestId(c: Context): string {
  return (c.get("requestId") as string) ?? "unknown";
}
