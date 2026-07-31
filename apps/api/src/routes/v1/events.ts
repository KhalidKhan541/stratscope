/**
 * Event routes — publishing and retrieval.
 *
 * Handles event creation and querying events for executions.
 * All routes are versioned under /v1/events and /v1/executions/:id/events.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const events = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const EVENT_TYPE_ENUM = z.enum([
  "execution.created",
  "execution.accepted",
  "execution.started",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "execution.archived",
  "evaluation.generated",
  "reflection.generated",
  "knowledge.extracted",
  "learning.generated",
  "optimization.generated",
  "recommendation.published",
]);

const publishEventBodySchema = z.object({
  execution_id: z.string().min(1, "execution_id is required"),
  event_type: EVENT_TYPE_ENUM,
  service: z.string().min(1).optional(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type PublishEventBody = z.infer<typeof publishEventBodySchema>;

const executionEventsParamsSchema = z.object({
  id: z.string().min(1),
});

const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface EventResponse {
  readonly id: string;
  readonly execution_id: string;
  readonly event_type: string;
  readonly service: string | null;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
  readonly schema_version: string;
}

interface EventListResponse {
  readonly data: readonly EventResponse[];
  readonly pagination: {
    readonly cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
}

function toEventResponse(row: Record<string, unknown>): EventResponse {
  let payload: Record<string, unknown> = {};
  if (typeof row["payload"] === "string") {
    try {
      payload = JSON.parse(row["payload"]) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

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
    execution_id: row["execution_id"] as string,
    event_type: row["event_type"] as string,
    service: (row["service"] as string) ?? null,
    payload,
    metadata,
    timestamp: row["timestamp"] as string,
    schema_version: row["schema_version"] as string,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /v1/events — Publish an event
 */
events.post(
  "/",
  validate({ body: publishEventBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    // Verify execution exists and belongs to the organization
    const execution = await c.env.DB.prepare(
      `SELECT id, organization_id, project_id FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(body.execution_id, auth.organizationId)
      .first<{ id: string; organization_id: string; project_id: string }>();

    if (!execution) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Execution with id '${body.execution_id}' not found`,
          },
        },
        404
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '1.0')`
    )
      .bind(
        id,
        body.execution_id,
        body.event_type,
        body.service ?? null,
        JSON.stringify(body.payload ?? {}),
        JSON.stringify(body.metadata ?? {}),
        now
      )
      .run();

    const response: EventResponse = {
      id,
      execution_id: body.execution_id,
      event_type: body.event_type,
      service: body.service ?? null,
      payload: body.payload ?? {},
      metadata: body.metadata ?? {},
      timestamp: now,
      schema_version: "1.0",
    };

    return c.json(response, 201);
  }
);

/**
 * GET /v1/executions/:id/events — Get events for an execution
 */
events.get(
  "/execution-events/:id",
  validate({ param: executionEventsParamsSchema, query: paginationQuerySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const query = c.req.valid("query") as any;

    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    // Verify execution exists and belongs to the organization
    const execution = await c.env.DB.prepare(
      `SELECT id FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string }>();

    if (!execution) {
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

    let whereClause = "WHERE execution_id = ?1";
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (cursor) {
      whereClause += ` AND timestamp < (SELECT timestamp FROM events WHERE id = ?${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM events ${whereClause}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total ?? 0;

    const rows = await c.env.DB.prepare(
      `SELECT * FROM events ${whereClause} ORDER BY timestamp DESC LIMIT ?${paramIndex}`
    )
      .bind(...params, limit + 1)
      .all<Record<string, unknown>>();

    const hasMore = rows.results.length > limit;
    const items = rows.results.slice(0, limit).map(toEventResponse);
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const response: EventListResponse = {
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

export { events as eventRoutes };
