/**
 * Public routes — unauthenticated read-only endpoints for the marketing site
 * and agent registration for public demo projects.
 *
 * Mounted under /v1/public. Exact-path routes bypass the /v1/* auth wildcard
 * (Hono's RegExpRouter prioritizes static paths), keeping these endpoints
 * open without authentication.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";

const publicRoutes = new Hono<{ Bindings: Env }>();

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

const registerAgentBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.string().max(50).optional().default("general"),
  consent_opt_in: z.boolean().optional().default(false),
});

interface PublicAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly framework: string | null;
  readonly model: string | null;
  readonly type: string;
  readonly consent_opt_in: boolean;
  readonly created_at: string;
}

function parseLimit(query: { limit?: number }): number {
  const limit = query.limit ?? DEFAULT_LIMIT;
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

function parseJsonField(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string" || value === "") {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * GET /v1/public/stats — aggregate counters for the marketing site.
 */
publicRoutes.get("/stats", async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json(
      {
        error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" },
      },
      503
    );
  }

  const [agents, executions, events, datasets, benchmarks, costRow, completedRow, totalRow] =
    await Promise.all([
      db.prepare(`SELECT COUNT(*) AS count FROM agents WHERE deleted_at IS NULL`).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM executions`).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM events`).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM datasets`).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM benchmarks`).first<{ count: number }>(),
      db
        .prepare(
          `SELECT COALESCE(AVG(estimated_cost), 0) AS avg_cost, COALESCE(SUM(estimated_cost), 0) AS total_cost FROM executions`
        )
        .first<{ avg_cost: number; total_cost: number }>(),
      db
        .prepare(`SELECT COUNT(*) AS count FROM executions WHERE status = 'completed'`)
        .first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM executions`).first<{ count: number }>(),
    ]);

  const executionCount = Number(executions?.count ?? 0);
  const completedCount = Number(completedRow?.count ?? 0);

  return c.json({
    data: {
      agents: Number(agents?.count ?? 0),
      executions: executionCount,
      events: Number(events?.count ?? 0),
      datasets: Number(datasets?.count ?? 0),
      benchmarks: Number(benchmarks?.count ?? 0),
      avg_cost_usd: Number(costRow?.avg_cost ?? 0),
      total_cost_usd: Number(costRow?.total_cost ?? 0),
      success_rate: executionCount > 0 ? Number(((completedCount / executionCount) * 100).toFixed(2)) : 0,
    },
  });
});

/**
 * GET /v1/public/executions?limit=N — recent public executions.
 */
publicRoutes.get(
  "/executions",
  validate({ query: limitQuerySchema }),
  async (c) => {
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } }, 503);
    }

    const rawLimit = c.req.query("limit");
    const limit = parseLimit({ limit: rawLimit ? Number(rawLimit) : undefined });

    const rows = await db
      .prepare(
        `SELECT e.*, a.name AS agent_name
         FROM executions e
         LEFT JOIN agents a ON a.id = e.agent_id
         ORDER BY e.created_at DESC
         LIMIT ?1`
      )
      .bind(limit)
      .all<Record<string, unknown>>();

    const executions = rows.results.map((row) => ({
      ...row,
      metadata: parseJsonField(row["metadata"], {}),
    }));

    return c.json(executions);
  }
);

/**
 * GET /v1/public/events?limit=N — recent public execution events.
 */
publicRoutes.get(
  "/events",
  validate({ query: limitQuerySchema }),
  async (c) => {
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } }, 503);
    }

    const rawLimit = c.req.query("limit");
    const limit = parseLimit({ limit: rawLimit ? Number(rawLimit) : undefined });

    const rows = await db
      .prepare(
        `SELECT * FROM events
         ORDER BY timestamp DESC
         LIMIT ?1`
      )
      .bind(limit)
      .all<Record<string, unknown>>();

    return c.json(rows.results);
  }
);

/**
 * GET /v1/public/agents — public agent directory.
 */
publicRoutes.get("/agents", async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } }, 503);
  }

  const rows = await db
    .prepare(
      `SELECT * FROM agents
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    )
    .all<Record<string, unknown>>();

  return c.json(rows.results);
});

/**
 * GET /v1/public/datasets — public dataset registry.
 */
publicRoutes.get("/datasets", async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } }, 503);
  }

  const rows = await db
    .prepare(
      `SELECT d.*,
              (SELECT MAX(version) FROM dataset_versions v WHERE v.dataset_id = d.id) AS latest_version
       FROM datasets d
       ORDER BY d.created_at DESC`
    )
    .all<Record<string, unknown>>();

  const datasets = rows.results.map((row) => ({
    ...row,
    tags: parseJsonField(row["tags"], []),
    metadata: parseJsonField(row["metadata"], {}),
  }));

  return c.json(datasets);
});

/**
 * GET /v1/public/benchmarks — public benchmark registry.
 */
publicRoutes.get("/benchmarks", async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } }, 503);
  }

  const rows = await db
    .prepare(
      `SELECT * FROM benchmarks
       ORDER BY created_at DESC`
    )
    .all<Record<string, unknown>>();

  return c.json(rows.results);
});

/**
 * POST /v1/public/agents/register — register a public demo agent.
 */
publicRoutes.post(
  "/agents/register",
  validate({ body: registerAgentBodySchema }),
  async (c) => {
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } }, 503);
    }

    const body = await c.req.json<{ name: string; type: string; consent_opt_in: boolean }>();

    const project =
      (await db
        .prepare(`SELECT id FROM projects WHERE slug = 'public' AND deleted_at IS NULL LIMIT 1`)
        .first<{ id: string }>()) ??
      (await db
        .prepare(`SELECT id FROM projects WHERE deleted_at IS NULL LIMIT 1`)
        .first<{ id: string }>());

    if (!project) {
      return c.json(
        {
          error: {
            code: "NO_PROJECT",
            message: "No project available for public agent registration",
          },
        },
        503
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const config = JSON.stringify({
      type: body.type,
      consent_opt_in: body.consent_opt_in,
      source: "public_register",
    });

    await db
      .prepare(
        `INSERT INTO agents (id, project_id, name, framework, config, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'custom', ?4, ?5, ?6)`
      )
      .bind(id, project.id, body.name, config, now, now)
      .run();

    const agent: PublicAgent = {
      id,
      name: body.name,
      description: null,
      framework: "custom",
      model: null,
      type: body.type,
      consent_opt_in: body.consent_opt_in,
      created_at: now,
    };

    return c.json(agent, 201);
  }
);

export { publicRoutes };
