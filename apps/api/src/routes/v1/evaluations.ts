/**
 * Evaluation routes — retrieval and comparison.
 *
 * Handles evaluation listing, retrieval, and comparison.
 * All routes are versioned under /v1/evaluations.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const evaluations = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const evaluationParamsSchema = z.object({
  id: z.string().min(1),
});

const listEvaluationsQuerySchema = z.object({
  execution_id: z.string().min(1).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const compareEvaluationsBodySchema = z.object({
  evaluation_id_a: z.string().min(1, "evaluation_id_a is required"),
  evaluation_id_b: z.string().min(1, "evaluation_id_b is required"),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface EvaluationResponse {
  readonly id: string;
  readonly execution_id: string;
  readonly accuracy: number | null;
  readonly goal_completion: number | null;
  readonly hallucination_score: number | null;
  readonly confidence: number | null;
  readonly cost_efficiency: number | null;
  readonly latency_score: number | null;
  readonly safety_score: number | null;
  readonly evaluation_model: string | null;
  readonly summary: string | null;
  readonly details: Record<string, unknown>;
  readonly created_at: string;
}

interface EvaluationListResponse {
  readonly data: readonly EvaluationResponse[];
  readonly pagination: {
    readonly cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
}

interface ComparisonDifference {
  readonly accuracy: number | null;
  readonly goal_completion: number | null;
  readonly hallucination_score: number | null;
  readonly confidence: number | null;
  readonly cost_efficiency: number | null;
  readonly latency_score: number | null;
  readonly safety_score: number | null;
}

interface ComparisonResponse {
  readonly evaluation_a: EvaluationResponse;
  readonly evaluation_b: EvaluationResponse;
  readonly differences: ComparisonDifference;
  readonly overall_improvement: number;
}

function toEvaluationResponse(row: Record<string, unknown>): EvaluationResponse {
  let details: Record<string, unknown> = {};
  if (typeof row["details"] === "string") {
    try {
      details = JSON.parse(row["details"]) as Record<string, unknown>;
    } catch {
      details = {};
    }
  }

  return {
    id: row["id"] as string,
    execution_id: row["execution_id"] as string,
    accuracy: (row["accuracy"] as number) ?? null,
    goal_completion: (row["goal_completion"] as number) ?? null,
    hallucination_score: (row["hallucination_score"] as number) ?? null,
    confidence: (row["confidence"] as number) ?? null,
    cost_efficiency: (row["cost_efficiency"] as number) ?? null,
    latency_score: (row["latency_score"] as number) ?? null,
    safety_score: (row["safety_score"] as number) ?? null,
    evaluation_model: (row["evaluation_model"] as string) ?? null,
    summary: (row["summary"] as string) ?? null,
    details,
    created_at: row["created_at"] as string,
  };
}

function computeDifference(
  a: EvaluationResponse,
  b: EvaluationResponse
): ComparisonDifference {
  return {
    accuracy: a.accuracy !== null && b.accuracy !== null ? b.accuracy - a.accuracy : null,
    goal_completion:
      a.goal_completion !== null && b.goal_completion !== null
        ? b.goal_completion - a.goal_completion
        : null,
    hallucination_score:
      a.hallucination_score !== null && b.hallucination_score !== null
        ? b.hallucination_score - a.hallucination_score
        : null,
    confidence:
      a.confidence !== null && b.confidence !== null ? b.confidence - a.confidence : null,
    cost_efficiency:
      a.cost_efficiency !== null && b.cost_efficiency !== null
        ? b.cost_efficiency - a.cost_efficiency
        : null,
    latency_score:
      a.latency_score !== null && b.latency_score !== null
        ? b.latency_score - a.latency_score
        : null,
    safety_score:
      a.safety_score !== null && b.safety_score !== null
        ? b.safety_score - a.safety_score
        : null,
  };
}

function computeOverallImprovement(diffs: ComparisonDifference): number {
  const values = [
    diffs.accuracy,
    diffs.goal_completion,
    diffs.confidence,
    diffs.cost_efficiency,
    diffs.latency_score,
    diffs.safety_score,
    diffs.hallucination_score !== null ? -diffs.hallucination_score : null,
  ].filter((v): v is number => v !== null);

  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /v1/evaluations — List evaluations
 */
evaluations.get(
  "/",
  validate({ query: listEvaluationsQuerySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const query = c.req.valid("query") as any;

    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    let whereClause = "WHERE e.execution_id IN (SELECT id FROM executions WHERE organization_id = ?1 AND deleted_at IS NULL)";
    const params: unknown[] = [auth.organizationId];
    let paramIndex = 2;

    if (query.execution_id) {
      whereClause += " AND e.execution_id = ?" + String(paramIndex);
      params.push(query.execution_id);
      paramIndex++;
    }

    if (cursor) {
      whereClause += ` AND e.created_at < (SELECT created_at FROM evaluations WHERE id = ?${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM evaluations e ${whereClause}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total ?? 0;

    const rows = await c.env.DB.prepare(
      `SELECT e.* FROM evaluations e ${whereClause} ORDER BY e.created_at DESC LIMIT ?${paramIndex}`
    )
      .bind(...params, limit + 1)
      .all<Record<string, unknown>>();

    const hasMore = rows.results.length > limit;
    const items = rows.results.slice(0, limit).map(toEvaluationResponse);
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const response: EvaluationListResponse = {
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
 * GET /v1/evaluations/:id — Get evaluation by ID
 */
evaluations.get(
  "/:id",
  validate({ param: evaluationParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT e.* FROM evaluations e
       JOIN executions ex ON ex.id = e.execution_id
       WHERE e.id = ?1 AND ex.organization_id = ?2 AND ex.deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Evaluation with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toEvaluationResponse(row), 200);
  }
);

/**
 * POST /v1/evaluations/compare — Compare two evaluations
 */
evaluations.post(
  "/compare",
  validate({ body: compareEvaluationsBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    const rowA = await c.env.DB.prepare(
      `SELECT e.* FROM evaluations e
       JOIN executions ex ON ex.id = e.execution_id
       WHERE e.id = ?1 AND ex.organization_id = ?2 AND ex.deleted_at IS NULL`
    )
      .bind(body.evaluation_id_a, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!rowA) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Evaluation with id '${body.evaluation_id_a}' not found`,
          },
        },
        404
      );
    }

    const rowB = await c.env.DB.prepare(
      `SELECT e.* FROM evaluations e
       JOIN executions ex ON ex.id = e.execution_id
       WHERE e.id = ?1 AND ex.organization_id = ?2 AND ex.deleted_at IS NULL`
    )
      .bind(body.evaluation_id_b, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!rowB) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Evaluation with id '${body.evaluation_id_b}' not found`,
          },
        },
        404
      );
    }

    const evalA = toEvaluationResponse(rowA);
    const evalB = toEvaluationResponse(rowB);
    const differences = computeDifference(evalA, evalB);
    const overallImprovement = computeOverallImprovement(differences);

    const response: ComparisonResponse = {
      evaluation_a: evalA,
      evaluation_b: evalB,
      differences,
      overall_improvement: overallImprovement,
    };

    return c.json(response, 200);
  }
);

export { evaluations as evaluationRoutes };
