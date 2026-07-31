/**
 * Benchmark API routes.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env";

const createBenchmarkSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(""),
  benchmark_type: z.enum([
    "model_comparison", "tool_comparison", "latency_comparison",
    "cost_comparison", "success_rate", "hallucination_rate",
    "agent_comparison", "execution_quality",
  ]),
  dataset_id: z.string().uuid().optional(),
});

export const benchmarkRoutes = new Hono<{ Bindings: Env }>();

benchmarkRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createBenchmarkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: parsed.error.flatten() } }, 400);
  }

  const orgId = c.get("organization_id") as string;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO benchmarks (id, organization_id, project_id, name, description, benchmark_type, status, entries, dataset_id, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', '[]', ?, '{}', ?, ?)`
  ).bind(
    id, orgId, parsed.data.project_id, parsed.data.name,
    parsed.data.description, parsed.data.benchmark_type,
    parsed.data.dataset_id ?? null, now, now
  ).run();

  return c.json({ data: { id, ...parsed.data, status: "draft", created_at: now } }, 201);
});

benchmarkRoutes.get("/", async (c) => {
  const orgId = c.get("organization_id") as string;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM benchmarks WHERE organization_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM benchmarks WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`;
  const params = cursor ? [orgId, cursor, limit + 1] : [orgId, limit + 1];

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const items = rows.results ?? [];
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  return c.json({
    data: sliced,
    pagination: {
      cursor: hasMore && sliced.length > 0 ? (sliced[sliced.length - 1] as Record<string, unknown>).created_at : null,
      has_more: hasMore,
      total_count: sliced.length,
    },
  });
});

benchmarkRoutes.get("/:id", async (c) => {
  const orgId = c.get("organization_id") as string;
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT * FROM benchmarks WHERE id = ? AND organization_id = ?`
  ).bind(id, orgId).first();

  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Benchmark not found" } }, 404);
  return c.json({ data: row });
});

benchmarkRoutes.post("/:id/run", async (c) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE benchmarks SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?`
  ).bind(now, now, id).run();

  // Trigger benchmark run via queue
  await c.env.QUEUE.send({
    batch: [{
      event_id: crypto.randomUUID(),
      event_type: "benchmark.run_requested",
      execution_id: id,
      organization_id: c.get("organization_id") as string,
      project_id: c.get("project_id") as string,
      timestamp: now,
      schema_version: "1.0.0",
      producer: "api",
      payload: { benchmark_id: id },
      metadata: {},
    }],
  });

  return c.json({ data: { id, status: "running", started_at: now } });
});