import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const experiments = new Hono<{ Bindings: Env }>();

const experimentParamsSchema = z.object({
  id: z.string().min(1),
});

const createExperimentBodySchema = z.object({
  project_id: z.string().min(1, "project_id is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  config: z.record(z.unknown()).optional(),
});

const completeExperimentBodySchema = z.object({
  results: z.record(z.unknown()),
  summary: z.string().max(2000).optional(),
});

interface ExperimentResponse {
  readonly id: string;
  readonly project_id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly config: Record<string, unknown>;
  readonly results: Record<string, unknown> | null;
  readonly summary: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
}

function toExperimentResponse(row: Record<string, unknown>): ExperimentResponse {
  let config: Record<string, unknown> = {};
  if (typeof row["config"] === "string") {
    try {
      config = JSON.parse(row["config"]) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }

  let results: Record<string, unknown> | null = null;
  if (typeof row["results"] === "string") {
    try {
      results = JSON.parse(row["results"]) as Record<string, unknown>;
    } catch {
      results = null;
    }
  }

  return {
    id: row["id"] as string,
    project_id: row["project_id"] as string,
    organization_id: row["organization_id"] as string,
    name: row["name"] as string,
    description: (row["description"] as string) ?? null,
    status: row["status"] as string,
    config,
    results,
    summary: (row["summary"] as string) ?? null,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
    started_at: (row["started_at"] as string) ?? null,
    completed_at: (row["completed_at"] as string) ?? null,
  };
}

experiments.post(
  "/",
  validate({ body: createExperimentBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    const project = await c.env.DB.prepare(
      `SELECT id FROM projects WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(body.project_id, auth.organizationId)
      .first<{ id: string }>();

    if (!project) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Project with id '${body.project_id}' not found`,
          },
        },
        404
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO experiments (id, project_id, organization_id, name, description, status, config, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
      .bind(
        id,
        body.project_id,
        auth.organizationId,
        body.name,
        body.description ?? null,
        "draft",
        JSON.stringify(body.config ?? {}),
        now,
        now
      )
      .run();

    const response: ExperimentResponse = {
      id,
      project_id: body.project_id,
      organization_id: auth.organizationId!,
      name: body.name,
      description: body.description ?? null,
      status: "draft",
      config: body.config ?? {},
      results: null,
      summary: null,
      created_at: now,
      updated_at: now,
      started_at: null,
      completed_at: null,
    };

    return c.json(response, 201);
  }
);

experiments.get("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM experiments WHERE organization_id = ?1 AND created_at < ?2 ORDER BY created_at DESC LIMIT ?3`
    : `SELECT * FROM experiments WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2`;
  const params = cursor
    ? [auth.organizationId, cursor, limit + 1]
    : [auth.organizationId, limit + 1];

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const items = (rows.results ?? []).map(toExperimentResponse);
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  return c.json({
    data: sliced,
    pagination: {
      cursor: hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.created_at : null,
      has_more: hasMore,
      total_count: sliced.length,
    },
  });
});

experiments.get(
  "/:id",
  validate({ param: experimentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM experiments WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Experiment with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toExperimentResponse(row), 200);
  }
);

experiments.post(
  "/:id/start",
  validate({ param: experimentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM experiments WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Experiment with id '${id}' not found`,
          },
        },
        404
      );
    }

    if (existing.status !== "draft") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `Cannot start experiment in '${existing.status}' status`,
          },
        },
        409
      );
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE experiments SET status = ?1, started_at = ?2, updated_at = ?3 WHERE id = ?4`
    )
      .bind("running", now, now, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM experiments WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    return c.json(toExperimentResponse(row!), 200);
  }
);

experiments.post(
  "/:id/complete",
  validate({ param: experimentParamsSchema, body: completeExperimentBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM experiments WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Experiment with id '${id}' not found`,
          },
        },
        404
      );
    }

    if (existing.status !== "running") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `Cannot complete experiment in '${existing.status}' status`,
          },
        },
        409
      );
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE experiments SET status = ?1, results = ?2, summary = ?3, completed_at = ?4, updated_at = ?5 WHERE id = ?6`
    )
      .bind("completed", JSON.stringify(body.results), body.summary ?? null, now, now, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM experiments WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    return c.json(toExperimentResponse(row!), 200);
  }
);

experiments.post(
  "/:id/cancel",
  validate({ param: experimentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM experiments WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Experiment with id '${id}' not found`,
          },
        },
        404
      );
    }

    if (existing.status === "completed" || existing.status === "cancelled") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `Cannot cancel experiment in '${existing.status}' status`,
          },
        },
        409
      );
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE experiments SET status = ?1, updated_at = ?2 WHERE id = ?3`
    )
      .bind("cancelled", now, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM experiments WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    return c.json(toExperimentResponse(row!), 200);
  }
);

export { experiments as experimentRoutes };
