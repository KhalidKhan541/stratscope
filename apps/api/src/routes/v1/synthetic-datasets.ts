import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const syntheticDatasets = new Hono<{ Bindings: Env }>();

const syntheticDatasetParamsSchema = z.object({
  id: z.string().min(1),
});

const createSyntheticDatasetBodySchema = z.object({
  project_id: z.string().min(1, "project_id is required"),
  name: z.string().min(1, "Name is required").max(100),
  source_model: z.string().min(1, "source_model is required").max(100),
  record_count: z.number().int().min(1).max(100000),
  schema: z.record(z.unknown()),
  config: z.record(z.unknown()).optional(),
});

interface SyntheticDatasetResponse {
  readonly id: string;
  readonly project_id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly source_model: string;
  readonly record_count: number;
  readonly schema: Record<string, unknown>;
  readonly config: Record<string, unknown>;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

function toSyntheticDatasetResponse(row: Record<string, unknown>): SyntheticDatasetResponse {
  let schema: Record<string, unknown> = {};
  if (typeof row["schema"] === "string") {
    try {
      schema = JSON.parse(row["schema"]) as Record<string, unknown>;
    } catch {
      schema = {};
    }
  }

  let config: Record<string, unknown> = {};
  if (typeof row["config"] === "string") {
    try {
      config = JSON.parse(row["config"]) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }

  return {
    id: row["id"] as string,
    project_id: row["project_id"] as string,
    organization_id: row["organization_id"] as string,
    name: row["name"] as string,
    source_model: row["source_model"] as string,
    record_count: row["record_count"] as number,
    schema,
    config,
    status: row["status"] as string,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

syntheticDatasets.post(
  "/",
  validate({ body: createSyntheticDatasetBodySchema }),
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
      `INSERT INTO synthetic_datasets (id, project_id, organization_id, name, source_model, record_count, schema, config, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
      .bind(
        id,
        body.project_id,
        auth.organizationId,
        body.name,
        body.source_model,
        body.record_count,
        JSON.stringify(body.schema),
        JSON.stringify(body.config ?? {}),
        "pending",
        now,
        now
      )
      .run();

    const response: SyntheticDatasetResponse = {
      id,
      project_id: body.project_id,
      organization_id: auth.organizationId!,
      name: body.name,
      source_model: body.source_model,
      record_count: body.record_count,
      schema: body.schema,
      config: body.config ?? {},
      status: "pending",
      created_at: now,
      updated_at: now,
    };

    return c.json(response, 201);
  }
);

syntheticDatasets.get("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM synthetic_datasets WHERE organization_id = ?1 AND created_at < ?2 ORDER BY created_at DESC LIMIT ?3`
    : `SELECT * FROM synthetic_datasets WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2`;
  const params = cursor
    ? [auth.organizationId, cursor, limit + 1]
    : [auth.organizationId, limit + 1];

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const items = (rows.results ?? []).map(toSyntheticDatasetResponse);
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

syntheticDatasets.get(
  "/:id",
  validate({ param: syntheticDatasetParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM synthetic_datasets WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Synthetic dataset with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toSyntheticDatasetResponse(row), 200);
  }
);

export { syntheticDatasets as syntheticDatasetRoutes };
