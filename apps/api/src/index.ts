/**
 * StratScope API — Main application entry point.
 *
 * Creates the Hono application with all middleware and routes registered.
 * This file is the Cloudflare Workers fetch handler.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./workers/env.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { authMiddleware } from "./middleware/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { defaultRateLimit } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { v1Routes } from "./routes/v1/index.js";
import { publicRoutes } from "./routes/v1/public.js";

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// CORS
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposeHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    maxAge: 86400,
  })
);

// Security headers
app.use("*", secureHeaders());

// Request ID — applied to every request
app.use("*", requestIdMiddleware);

// ---------------------------------------------------------------------------
// Health check — no auth required
// ---------------------------------------------------------------------------

app.get("/v1/health", (c) => {
  return c.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Public routes — no auth required
// ---------------------------------------------------------------------------

app.route("/v1/public", publicRoutes);

// ---------------------------------------------------------------------------
// API routes — auth + rate limiting required
// ---------------------------------------------------------------------------

app.use("/v1/*", requireAuth);
app.use("/v1/*", defaultRateLimit);

app.route("/v1", v1Routes);

// ---------------------------------------------------------------------------
// Not found handler
// ---------------------------------------------------------------------------

app.get("/", (c) => {
  return c.json({
    name: "StratScope API",
    version: "1.0.0",
    description: "AI Execution Intelligence Platform",
    docs: "/v1/health",
  });
});

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.onError(errorHandler);

export default app;
