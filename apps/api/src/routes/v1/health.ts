/**
 * Health check route.
 *
 * Returns the API status, version, and timestamp.
 * Used by load balancers and monitoring systems.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";

const health = new Hono<{ Bindings: Env }>();

const HEALTH_RESPONSE_SCHEMA = z.object({
  status: z.literal("ok"),
  version: z.string(),
  timestamp: z.string().datetime(),
});

type HealthResponse = z.infer<typeof HEALTH_RESPONSE_SCHEMA>;

health.get("/", (c) => {
  const response: HealthResponse = {
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };

  return c.json(response, 200);
});

export { health as healthRoutes };
