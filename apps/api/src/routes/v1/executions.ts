/**
 * Execution routes — CRUD and lifecycle management.
 *
 * Handles execution creation, retrieval, updates, completion, and replay.
 * All routes are versioned under /v1/executions.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const executions = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const EXECUTION_STATUS_ENUM = z.enum([
  "created",
  "accepted",
  "running",
  "completed",
  "failed",
  "cancelled",
  "archived",
]);

const createExecutionBodySchema = z.object({
  project_id: z.string().min(1, "project_id is required"),
  agent_id: z.string().min(1).optional(),
  input: z.string().min(1, "input is required"),
  model: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  parent_execution_id: z.string().min(1).optional(),
  pipeline_version: z.string().min(1).optional(),
  sdk_version: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type CreateExecutionBody = z.infer<typeof createExecutionBodySchema>;

const executionParamsSchema = z.object({
  id: z.string().min(1),
});

const listExecutionsQuerySchema = z.object({
  project_id: z.string().min(1).optional(),
  agent_id: z.string().min(1).optional(),
  status: EXECUTION_STATUS_ENUM.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const updateExecutionBodySchema = z.object({
  status: EXECUTION_STATUS_ENUM.optional(),
  metadata: z.record(z.unknown()).optional(),
});

const completeExecutionBodySchema = z.object({
  latency_ms: z.number().int().nonnegative().optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  output_ref: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface ExecutionResponse {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id: string | null;
  readonly status: string;
  readonly model: string | null;
  readonly provider: string | null;
  readonly trace_id: string | null;
  readonly parent_execution_id: string | null;
  readonly pipeline_version: string | null;
  readonly sdk_version: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly latency_ms: number | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly total_tokens: number | null;
  readonly estimated_cost: number | null;
  readonly input_ref: string | null;
  readonly output_ref: string | null;
  readonly metadata: Record<string, unknown>;
  readonly error: string | null;
  readonly created_at: string;
}

interface ExecutionListResponse {
  readonly data: readonly ExecutionResponse[];
  readonly pagination: {
    readonly cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
}

interface CreateExecutionResponse {
  readonly id: string;
  readonly trace_id: string;
  readonly status: string;
  readonly created_at: string;
}

function toExecutionResponse(row: Record<string, unknown>): ExecutionResponse {
  let metadata: Record<string, unknown> = {};
  if (typeof row["metadata"] === "string") {
    try {
      metadata = JSON.parse(row["metadata"]) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
  }

  return {
    id: row["id"] as string,
    organization_id: row["organization_id"] as string,
    project_id: row["project_id"] as string,
    agent_id: (row["agent_id"] as string) ?? null,
    status: row["status"] as string,
    model: (row["model"] as string) ?? null,
    provider: (row["provider"] as string) ?? null,
    trace_id: (row["trace_id"] as string) ?? null,
    parent_execution_id: (row["parent_execution_id"] as string) ?? null,
    pipeline_version: (row["pipeline_version"] as string) ?? null,
    sdk_version: (row["sdk_version"] as string) ?? null,
    started_at: (row["started_at"] as string) ?? null,
    completed_at: (row["completed_at"] as string) ?? null,
    latency_ms: (row["latency_ms"] as number) ?? null,
    input_tokens: (row["input_tokens"] as number) ?? null,
    output_tokens: (row["output_tokens"] as number) ?? null,
    total_tokens: (row["total_tokens"] as number) ?? null,
    estimated_cost: (row["estimated_cost"] as number) ?? null,
    input_ref: (row["input_ref"] as string) ?? null,
    output_ref: (row["output_ref"] as string) ?? null,
    metadata,
    error: (row["error"] as string) ?? null,
    created_at: row["created_at"] as string,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /v1/executions — Create an execution
 */
executions.post(
  "/",
  validate({ body: createExecutionBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    const id = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = c.env.DB.prepare(
      `INSERT INTO executions (
        id, organization_id, project_id, agent_id, status,
        model, provider, trace_id, pipeline_version, sdk_version,
        metadata, created_at
      ) VALUES (
        ?1, ?2, ?3, ?4, 'created',
        ?5, ?6, ?7, ?8, ?9,
        ?10, ?11
      )`
    );

    await stmt
      .bind(
        id,
        auth.organizationId,
        auth.projectId,
        body.agent_id ?? null,
        body.model ?? null,
        body.provider ?? null,
        traceId,
        body.pipeline_version ?? null,
        body.sdk_version ?? null,
        JSON.stringify(body.metadata ?? {}),
        now
      )
      .run();

    // Emit execution.created event
    await c.env.DB.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?1, ?2, 'execution.created', 'api', ?3, '{}', ?4, '1.0')`
    )
      .bind(crypto.randomUUID(), id, JSON.stringify({ input: body.input }), now)
      .run();

    const response: CreateExecutionResponse = {
      id,
      trace_id: traceId,
      status: "created",
      created_at: now,
    };

    return c.json(response, 201);
  }
);

/**
 * GET /v1/executions — List executions
 */
executions.get(
  "/",
  validate({ query: listExecutionsQuerySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const query = c.req.valid("query") as any;

    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    let whereClause = "WHERE organization_id = ?1 AND deleted_at IS NULL";
    const params: unknown[] = [auth.organizationId];
    let paramIndex = params.length + 1;

    if (query.project_id) {
      whereClause += ` AND project_id = ?${paramIndex}`;
      params.push(query.project_id);
      paramIndex++;
    }

    if (query.agent_id) {
      whereClause += ` AND agent_id = ?${paramIndex}`;
      params.push(query.agent_id);
      paramIndex++;
    }

    if (query.status) {
      whereClause += ` AND status = ?${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    if (cursor) {
      whereClause += ` AND created_at < (SELECT created_at FROM executions WHERE id = ?${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM executions ${whereClause}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total ?? 0;

    const rows = await c.env.DB.prepare(
      `SELECT * FROM executions ${whereClause} ORDER BY created_at DESC LIMIT ?${paramIndex}`
    )
      .bind(...params, limit + 1)
      .all<Record<string, unknown>>();

    const hasMore = rows.results.length > limit;
    const items = rows.results.slice(0, limit).map(toExecutionResponse);
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const response: ExecutionListResponse = {
      data: items,
      pagination: {
        cursor: nextCursor,
        has_more: hasMore,
        limit,
      },
    };

    return c.json(response, 200);
  }
);

/**
 * GET /v1/executions/:id — Get execution by ID
 */
executions.get(
  "/:id",
  validate({ param: executionParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Execution with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toExecutionResponse(row), 200);
  }
);

/**
 * PATCH /v1/executions/:id — Update execution
 */
executions.patch(
  "/:id",
  validate({ param: executionParamsSchema, body: updateExecutionBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Execution with id '${id}' not found`,
          },
        },
        404
      );
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.status !== undefined) {
      setClauses.push(`status = ?${paramIndex}`);
      params.push(body.status);
      paramIndex++;
    }

    if (body.metadata !== undefined) {
      setClauses.push(`metadata = ?${paramIndex}`);
      params.push(JSON.stringify(body.metadata));
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "No fields to update",
          },
        },
        400
      );
    }

    await c.env.DB.prepare(
      `UPDATE executions SET ${setClauses.join(", ")} WHERE id = ?${paramIndex} AND organization_id = ?${paramIndex + 1}`
    )
      .bind(...params, id, auth.organizationId)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM executions WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated execution",
          },
        },
        500
      );
    }

    return c.json(toExecutionResponse(row), 200);
  }
);

/**
 * POST /v1/executions/:id/complete — Complete an execution
 */
executions.post(
  "/:id/complete",
  validate({ param: executionParamsSchema, body: completeExecutionBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Execution with id '${id}' not found`,
          },
        },
        404
      );
    }

    if (existing.status === "completed") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "Execution is already completed",
          },
        },
        409
      );
    }

    const completedAt = new Date().toISOString();

    const setClauses: string[] = [
      "status = 'completed'",
      `completed_at = '${completedAt}'`,
    ];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.latency_ms !== undefined) {
      setClauses.push(`latency_ms = ?${paramIndex}`);
      params.push(body.latency_ms);
      paramIndex++;
    }

    if (body.input_tokens !== undefined) {
      setClauses.push(`input_tokens = ?${paramIndex}`);
      params.push(body.input_tokens);
      paramIndex++;
    }

    if (body.output_tokens !== undefined) {
      setClauses.push(`output_tokens = ?${paramIndex}`);
      params.push(body.output_tokens);
      paramIndex++;
    }

    if (body.total_tokens !== undefined) {
      setClauses.push(`total_tokens = ?${paramIndex}`);
      params.push(body.total_tokens);
      paramIndex++;
    }

    if (body.estimated_cost !== undefined) {
      setClauses.push(`estimated_cost = ?${paramIndex}`);
      params.push(body.estimated_cost);
      paramIndex++;
    }

    if (body.output_ref !== undefined) {
      setClauses.push(`output_ref = ?${paramIndex}`);
      params.push(body.output_ref);
      paramIndex++;
    }

    if (body.metadata !== undefined) {
      setClauses.push(`metadata = ?${paramIndex}`);
      params.push(JSON.stringify(body.metadata));
      paramIndex++;
    }

    await c.env.DB.prepare(
      `UPDATE executions SET ${setClauses.join(", ")} WHERE id = ?${paramIndex} AND organization_id = ?${paramIndex + 1}`
    )
      .bind(...params, id, auth.organizationId)
      .run();

    // Emit execution.completed event
    await c.env.DB.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?1, ?2, 'execution.completed', 'api', ?3, '{}', ?4, '1.0')`
    )
      .bind(
        crypto.randomUUID(),
        id,
        JSON.stringify(body),
        completedAt
      )
      .run();

    // Queue pipeline processing
    await c.env.QUEUE.send({
      type: "execution.completed",
      executionId: id,
      organizationId: auth.organizationId,
      projectId: auth.projectId,
    });

    const row = await c.env.DB.prepare(
      `SELECT * FROM executions WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve completed execution",
          },
        },
        500
      );
    }

    return c.json(toExecutionResponse(row), 200);
  }
);

/**
 * POST /v1/executions/:id/replay — Replay an execution
 */
executions.post(
  "/:id/replay",
  validate({ param: executionParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const original = await c.env.DB.prepare(
      `SELECT * FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!original) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Execution with id '${id}' not found`,
          },
        },
        404
      );
    }

    const newId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO executions (
        id, organization_id, project_id, agent_id, status,
        model, provider, trace_id, parent_execution_id,
        pipeline_version, sdk_version, metadata, created_at
      ) VALUES (
        ?1, ?2, ?3, ?4, 'created',
        ?5, ?6, ?7, ?8,
        ?9, ?10, ?11, ?12
      )`
    )
      .bind(
        newId,
        auth.organizationId,
        original["project_id"],
        original["agent_id"],
        original["model"],
        original["provider"],
        traceId,
        id,
        original["pipeline_version"],
        original["sdk_version"],
        original["metadata"],
        now
      )
      .run();

    // Emit execution.created event for replay
    await c.env.DB.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?1, ?2, 'execution.created', 'api', ?3, ?4, ?5, '1.0')`
    )
      .bind(
        crypto.randomUUID(),
        newId,
        JSON.stringify({ replayed_from: id }),
        JSON.stringify({ replay: true }),
        now
      )
      .run();

    const response: CreateExecutionResponse = {
      id: newId,
      trace_id: traceId,
      status: "created",
      created_at: now,
    };

    return c.json(response, 201);
  }
);

export { executions as executionRoutes };
