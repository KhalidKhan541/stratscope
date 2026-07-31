/**
 * Research Intelligence API routes.
 *
 * Aggregates datasets, benchmarks, and corpora under a unified research namespace.
 */

import { Hono } from "hono";
import type { Env } from "../../workers/env";

export const researchRoutes = new Hono<{ Bindings: Env }>();

researchRoutes.get("/overview", async (c) => {
  const orgId = c.get("organization_id") as string;

  const [datasets, benchmarks, corpora] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM datasets WHERE organization_id = ?`).bind(orgId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM benchmarks WHERE organization_id = ?`).bind(orgId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM corpora WHERE organization_id = ?`).bind(orgId).first(),
  ]);

  return c.json({
    data: {
      datasets: datasets?.count ?? 0,
      benchmarks: benchmarks?.count ?? 0,
      corpora: corpora?.count ?? 0,
    },
  });
});

researchRoutes.get("/search", async (c) => {
  const orgId = c.get("organization_id") as string;
  const q = c.req.query("q") ?? "";

  const [datasets, benchmarks, corpora] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, name, description, 'dataset' as type FROM datasets WHERE organization_id = ? AND (name LIKE ? OR description LIKE ?) LIMIT 10`
    ).bind(orgId, `%${q}%`, `%${q}%`).all(),
    c.env.DB.prepare(
      `SELECT id, name, description, 'benchmark' as type FROM benchmarks WHERE organization_id = ? AND (name LIKE ? OR description LIKE ?) LIMIT 10`
    ).bind(orgId, `%${q}%`, `%${q}%`).all(),
    c.env.DB.prepare(
      `SELECT id, name, description, 'corpus' as type FROM corpora WHERE organization_id = ? AND (name LIKE ? OR description LIKE ?) LIMIT 10`
    ).bind(orgId, `%${q}%`, `%${q}%`).all(),
  ]);

  const results = [
    ...(datasets.results ?? []),
    ...(benchmarks.results ?? []),
    ...(corpora.results ?? []),
  ];

  return c.json({ data: results });
});