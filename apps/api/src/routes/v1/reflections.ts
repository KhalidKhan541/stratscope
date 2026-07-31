/**
 * Reflection routes — generation and retrieval.
 *
 * Handles reflection listing, retrieval, and generation.
 * All routes are versioned under /v1/reflections.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const reflections = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const reflectionParamsSchema = z.object({
  id: z.string().min(1),
});

const listReflectionsQuerySchema = z.object({
  execution_id: z.string().min(1).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const generateReflectionBodySchema = z.object({
  execution_id: z.string().min(1, "execution_id is required"),
  model: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface ReflectionResponse {
  readonly id: string;
  readonly execution_id: string;
  readonly summary: string | null;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly recommendations: readonly string[];
  readonly confidence: number | null;
  readonly reflection_model: string | null;
  readonly reasoning: string | null;
  readonly created_at: string;
}

interface ReflectionListResponse {
  readonly data: readonly ReflectionResponse[];
  readonly pagination: {
    readonly cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
}

function parseJsonArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // fall through
    }
  }
  return [];
}

function toReflectionResponse(row: Record<string, unknown>): ReflectionResponse {
  return {
    id: row["id"] as string,
    execution_id: row["execution_id"] as string,
    summary: (row["summary"] as string) ?? null,
    strengths: parseJsonArray(row["strengths"]),
    weaknesses: parseJsonArray(row["weaknesses"]),
    recommendations: parseJsonArray(row["recommendations"]),
    confidence: (row["confidence"] as number) ?? null,
    reflection_model: (row["reflection_model"] as string) ?? null,
    reasoning: (row["reasoning"] as string) ?? null,
    created_at: row["created_at"] as string,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /v1/reflections — List reflections
 */
reflections.get(
  "/",
  validate({ query: listReflectionsQuerySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const query = c.req.valid("query") as any;

    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    let whereClause =
      "WHERE r.execution_id IN (SELECT id FROM executions WHERE organization_id = ?1 AND deleted_at IS NULL)";
    const params: unknown[] = [auth.organizationId];
    let paramIndex = 2;

    if (query.execution_id) {
      whereClause += ` AND r.execution_id = ?${paramIndex}`;
      params.push(query.execution_id);
      paramIndex++;
    }

    if (cursor) {
      whereClause += ` AND r.created_at < (SELECT created_at FROM reflections WHERE id = ?${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM reflections r ${whereClause}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total ?? 0;

    const rows = await c.env.DB.prepare(
      `SELECT r.* FROM reflections r ${whereClause} ORDER BY r.created_at DESC LIMIT ?${paramIndex}`
    )
      .bind(...params, limit + 1)
      .all<Record<string, unknown>>();

    const hasMore = rows.results.length > limit;
    const items = rows.results.slice(0, limit).map(toReflectionResponse);
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const response: ReflectionListResponse = {
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
 * GET /v1/reflections/:id — Get reflection by ID
 */
reflections.get(
  "/:id",
  validate({ param: reflectionParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT r.* FROM reflections r
       JOIN executions ex ON ex.id = r.execution_id
       WHERE r.id = ?1 AND ex.organization_id = ?2 AND ex.deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Reflection with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toReflectionResponse(row), 200);
  }
);

/**
 * POST /v1/reflections — Generate a reflection
 */
reflections.post(
  "/",
  validate({ body: generateReflectionBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    // Verify execution exists and belongs to the organization
    const execution = await c.env.DB.prepare(
      `SELECT id, status FROM executions WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(body.execution_id, auth.organizationId)
      .first<{ id: string; status: string }>();

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

    if (execution.status !== "completed") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "Execution must be completed before generating a reflection",
          },
        },
        409
      );
    }

    // Check if reflection already exists for this execution
    const existing = await c.env.DB.prepare(
      `SELECT id FROM reflections WHERE execution_id = ?1`
    )
      .bind(body.execution_id)
      .first<{ id: string }>();

    if (existing) {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "Reflection already exists for this execution",
          },
        },
        409
      );
    }

    const reflectionModel = body.model ?? "stratscope/reflection-v1";
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // In a real implementation, this would call an LLM to generate the reflection.
    // For now, we create a placeholder reflection.
    const summary = `Reflection generated for execution ${body.execution_id}`;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    const confidence = 0.5;
    const reasoning = "Automated reflection placeholder";

    await c.env.DB.prepare(
      `INSERT INTO reflections (
        id, execution_id, summary, strengths, weaknesses, recommendations,
        confidence, reflection_model, reasoning, created_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6,
        ?7, ?8, ?9, ?10
      )`
    )
      .bind(
        id,
        body.execution_id,
        summary,
        JSON.stringify(strengths),
        JSON.stringify(weaknesses),
        JSON.stringify(recommendations),
        confidence,
        reflectionModel,
        reasoning,
        now
      )
      .run();

    // Emit reflection.generated event
    await c.env.DB.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?1, ?2, 'reflection.generated', 'api', ?3, '{}', ?4, '1.0')`
    )
      .bind(crypto.randomUUID(), body.execution_id, JSON.stringify({ reflection_id: id }), now)
      .run();

    const response: ReflectionResponse = {
      id,
      execution_id: body.execution_id,
      summary,
      strengths,
      weaknesses,
      recommendations,
      confidence,
      reflection_model: reflectionModel,
      reasoning,
      created_at: now,
    };

    return c.json(response, 201);
  }
);

export { reflections as reflectionRoutes };
