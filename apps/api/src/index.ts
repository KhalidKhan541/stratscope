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
import { generateBenchmarkReports } from "./jobs/benchmarkReports.js";

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

// ---------------------------------------------------------------------------
// Scheduled jobs — Cloudflare Cron Triggers
// ---------------------------------------------------------------------------

app.post("/__scheduled", async (c) => {
  const env = c.env as Env;
  const log = JSON.stringify({
    level: "info",
    message: "Running scheduled benchmark report generation",
    service: "api",
    timestamp: new Date().toISOString(),
  });
  console.log(log);

  try {
    const reports = await generateBenchmarkReports(env);
    return c.json({ success: true, reports: reports.length }, 200);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Benchmark report generation failed",
        service: "api",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
    );
    return c.json({ success: false, error: "report generation failed" }, 500);
  }
});

// ---------------------------------------------------------------------------
// Protected admin trigger — used by the SEEA workflow (no cron slot available
// on the free plan). Header X-Benchmark-Key must match the secret.
// ---------------------------------------------------------------------------

app.post("/admin/benchmark-reports", async (c) => {
  const env = c.env as Env;
  const expected = env.BENCHMARK_KEY;
  const provided = c.req.header("X-Benchmark-Key");

  if (!expected || provided !== expected) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid benchmark key" } }, 401);
  }

  try {
    const reports = await generateBenchmarkReports(env);
    return c.json({ success: true, reports: reports.length }, 200);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Benchmark report generation failed",
        service: "api",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
    );
    return c.json({ success: false, error: "report generation failed" }, 500);
  }
});

export default app;
