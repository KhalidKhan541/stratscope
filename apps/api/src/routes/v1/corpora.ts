/**
 * Corpus API routes.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env";

const createCorpusSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(""),
  dataset_ids: z.array(z.string().uuid()).default([]),
  benchmark_ids: z.array(z.string().uuid()).default([]),
  tags: z.array(z.string()).default([]),
});

export const corpusRoutes = new Hono<{ Bindings: Env }>();

corpusRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createCorpusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: parsed.error.flatten() } }, 400);
  }

  const orgId = c.get("organization_id") as string;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO corpora (id, organization_id, project_id, name, description, status, dataset_ids, benchmark_ids, tags, version, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 1, '{}', ?, ?)`
  ).bind(
    id, orgId, parsed.data.project_id, parsed.data.name,
    parsed.data.description,
    JSON.stringify(parsed.data.dataset_ids),
    JSON.stringify(parsed.data.benchmark_ids),
    JSON.stringify(parsed.data.tags),
    now, now
  ).run();

  return c.json({ data: { id, ...parsed.data, status: "draft", version: 1, created_at: now } }, 201);
});

corpusRoutes.get("/", async (c) => {
  const orgId = c.get("organization_id") as string;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM corpora WHERE organization_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM corpora WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`;
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

corpusRoutes.get("/:id", async (c) => {
  const orgId = c.get("organization_id") as string;
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT * FROM corpora WHERE id = ? AND organization_id = ?`
  ).bind(id, orgId).first();

  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Corpus not found" } }, 404);
  return c.json({ data: row });
});

corpusRoutes.post("/:id/publish", async (c) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE corpora SET status = 'published', updated_at = ? WHERE id = ?`
  ).bind(now, id).run();

  return c.json({ data: { id, status: "published", updated_at: now } });
});

corpusRoutes.post("/:id/datasets", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const datasetId = body.dataset_id as string;

  const row = await c.env.DB.prepare(`SELECT * FROM corpora WHERE id = ?`).bind(id).first();
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Corpus not found" } }, 404);

  const datasets = JSON.parse((row.dataset_ids as string) ?? "[]") as string[];
  if (!datasets.includes(datasetId)) datasets.push(datasetId);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE corpora SET dataset_ids = ?, updated_at = ? WHERE id = ?`
  ).bind(JSON.stringify(datasets), now, id).run();

  return c.json({ data: { dataset_ids: datasets } });
});