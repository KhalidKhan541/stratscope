/**
 * Recommendation routes — management and application.
 *
 * Handles recommendation listing and application.
 * All routes are versioned under /v1/recommendations.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const recommendations = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const RECOMMENDATION_STATUS_ENUM = z.enum([
  "pending",
  "accepted",
  "applied",
  "rejected",
  "expired",
]);

const RECOMMENDATION_PRIORITY_ENUM = z.enum(["low", "medium", "high", "critical"]);

const listRecommendationsQuerySchema = z.object({
  project_id: z.string().min(1).optional(),
  status: RECOMMENDATION_STATUS_ENUM.optional(),
  priority: RECOMMENDATION_PRIORITY_ENUM.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const recommendationParamsSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface RecommendationResponse {
  readonly id: string;
  readonly execution_id: string;
  readonly project_id: string;
  readonly organization_id: string;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly priority: string;
  readonly status: string;
  readonly impact_estimate: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly applied_at: string | null;
}

interface RecommendationListResponse {
  readonly data: readonly RecommendationResponse[];
  readonly pagination: {
    readonly cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
}

function toRecommendationResponse(row: Record<string, unknown>): RecommendationResponse {
  let impactEstimate: Record<string, unknown> | null = null;
  if (typeof row["impact_estimate"] === "string") {
    try {
      impactEstimate = JSON.parse(row["impact_estimate"]) as Record<string, unknown>;
    } catch {
      impactEstimate = null;
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
    project_id: row["project_id"] as string,
    organization_id: row["organization_id"] as string,
    type: row["type"] as string,
    title: row["title"] as string,
    description: row["description"] as string,
    priority: row["priority"] as string,
    status: row["status"] as string,
    impact_estimate: impactEstimate,
    metadata,
    created_at: row["created_at"] as string,
    applied_at: (row["applied_at"] as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /v1/recommendations — List recommendations
 */
recommendations.get(
  "/",
  validate({ query: listRecommendationsQuerySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const query = c.req.valid("query") as any;

    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    let whereClause = "WHERE organization_id = ?1";
    const params: unknown[] = [auth.organizationId];
    let paramIndex = 2;

    if (query.project_id) {
      whereClause += ` AND project_id = ?${paramIndex}`;
      params.push(query.project_id);
      paramIndex++;
    }

    if (query.status) {
      whereClause += ` AND status = ?${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    if (query.priority) {
      whereClause += ` AND priority = ?${paramIndex}`;
      params.push(query.priority);
      paramIndex++;
    }

    if (cursor) {
      whereClause += ` AND created_at < (SELECT created_at FROM recommendations WHERE id = ?${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM recommendations ${whereClause}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total ?? 0;

    const rows = await c.env.DB.prepare(
      `SELECT * FROM recommendations ${whereClause} ORDER BY created_at DESC LIMIT ?${paramIndex}`
    )
      .bind(...params, limit + 1)
      .all<Record<string, unknown>>();

    const hasMore = rows.results.length > limit;
    const items = rows.results.slice(0, limit).map(toRecommendationResponse);
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const response: RecommendationListResponse = {
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
 * POST /v1/recommendations/:id/apply — Apply a recommendation
 */
recommendations.post(
  "/:id/apply",
  validate({ param: recommendationParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM recommendations WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Recommendation with id '${id}' not found`,
          },
        },
        404
      );
    }

    if (existing.status === "applied") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "Recommendation is already applied",
          },
        },
        409
      );
    }

    if (existing.status === "rejected" || existing.status === "expired") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `Cannot apply recommendation with status '${existing.status}'`,
          },
        },
        409
      );
    }

    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `UPDATE recommendations SET status = 'applied', applied_at = ?1 WHERE id = ?2 AND organization_id = ?3`
    )
      .bind(now, id, auth.organizationId)
      .run();

    // Emit recommendation.applied event
    await c.env.DB.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?1, (SELECT execution_id FROM recommendations WHERE id = ?2), 'recommendation.published', 'api', ?3, '{}', ?4, '1.0')`
    )
      .bind(crypto.randomUUID(), id, JSON.stringify({ recommendation_id: id, action: "applied" }), now)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM recommendations WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated recommendation",
          },
        },
        500
      );
    }

    return c.json(toRecommendationResponse(row), 200);
  }
);

export { recommendations as recommendationRoutes };
