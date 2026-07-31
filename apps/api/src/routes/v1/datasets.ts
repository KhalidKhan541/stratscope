/**
 * Dataset API routes.
 *
 * CRUD and export operations for research datasets.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env";

const createDatasetSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(""),
  category: z.enum([
    "failure", "reasoning", "tool_selection", "model_routing",
    "prompt_improvement", "reflection", "evaluation", "knowledge",
    "coding", "planning", "research",
  ]),
  tags: z.array(z.string()).default([]),
  filters: z.record(z.unknown()).default({}),
});

const exportDatasetSchema = z.object({
  format: z.enum(["jsonl", "parquet", "csv", "arrow", "rest"]),
});

export const datasetRoutes = new Hono<{ Bindings: Env }>();

datasetRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createDatasetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: parsed.error.flatten() } }, 400);
  }

  const orgId = c.get("organization_id") as string;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO datasets (id, organization_id, project_id, name, description, category, status, version, tags, filters, export_formats, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'building', 1, ?, ?, '["jsonl","csv"]', '{}', ?, ?)`
  ).bind(
    id, orgId, parsed.data.project_id, parsed.data.name,
    parsed.data.description, parsed.data.category,
    JSON.stringify(parsed.data.tags), JSON.stringify(parsed.data.filters),
    now, now
  ).run();

  return c.json({ data: { id, ...parsed.data, status: "building", version: 1, created_at: now } }, 201);
});

datasetRoutes.get("/", async (c) => {
  const orgId = c.get("organization_id") as string;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM datasets WHERE organization_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM datasets WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`;
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

datasetRoutes.get("/:id", async (c) => {
  const orgId = c.get("organization_id") as string;
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT * FROM datasets WHERE id = ? AND organization_id = ?`
  ).bind(id, orgId).first();

  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Dataset not found" } }, 404);
  return c.json({ data: row });
});

datasetRoutes.post("/:id/export", async (c) => {
  const id = c.req.param("id");
  const orgId = c.get("organization_id") as string;
  const body = await c.req.json();
  const parsed = exportDatasetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid format" } }, 400);
  }

  const exportId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO dataset_exports (id, dataset_id, organization_id, format, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).bind(exportId, id, orgId, parsed.data.format, now).run();

  return c.json({ data: { id: exportId, dataset_id: id, format: parsed.data.format, status: "pending", created_at: now } }, 201);
});

datasetRoutes.post("/:id/validate", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT * FROM datasets WHERE id = ?`).bind(id).first();
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Dataset not found" } }, 404);

  const errors: string[] = [];
  if ((row.record_count as number) === 0) errors.push("No records");

  return c.json({ data: { valid: errors.length === 0, errors } });
});

datasetRoutes.get("/:id/versions", async (c) => {
  const id = c.req.param("id");
  const rows = await c.env.DB.prepare(
    `SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version DESC`
  ).bind(id).all();

  return c.json({ data: rows.results ?? [] });
});