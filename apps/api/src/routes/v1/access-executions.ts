/**
 * Access execution routes — read-only execution access for external
 * data consumers authenticated with an access grant credential.
 *
 * Mounted under /v1/access. Access grants are read-only credentials,
 * so these routes never write to the database. Every successful read
 * is recorded in the access audit log for usage-based invoicing.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import {
  accessKeyAuth,
  getAccessGrant,
} from "../../middleware/accessKeyAuth.js";
import { recordAccessAudit } from "../../lib/accessAudit.js";
import { redactPayload, redactString } from "../../lib/redact.js";

const accessExecutions = new Hono<{ Bindings: Env }>();

accessExecutions.use("*", accessKeyAuth);

const EXECUTION_STATUS_ENUM = z.enum([
  "created",
  "accepted",
  "running",
  "completed",
  "failed",
  "cancelled",
  "archived",
]);

const listExecutionsQuerySchema = z.object({
  agent_id: z.string().min(1).optional(),
  status: EXECUTION_STATUS_ENUM.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
});

const executionParamsSchema = z.object({
  id: z.string().min(1),
});

interface AccessExecutionResponse {
  readonly id: string;
  readonly agent_id: string | null;
  readonly status: string;
  readonly model: string | null;
  readonly provider: string | null;
  readonly trace_id: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly latency_ms: number | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly total_tokens: number | null;
  readonly estimated_cost: number | null;
  readonly error: string | null;
  readonly created_at: string;
  readonly metadata: Record<string, unknown>;
}

interface AccessEventResponse {
  readonly id: string;
  readonly execution_id: string;
  readonly event_type: string;
  readonly service: string | null;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
  readonly schema_version: string;
}

interface AccessEvaluationResponse {
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

interface AccessReflectionResponse {
  readonly id: string;
  readonly execution_id: string;
  readonly summary: string | null;
  readonly strengths: unknown[];
  readonly weaknesses: unknown[];
  readonly recommendations: unknown[];
  readonly confidence: number | null;
  readonly reflection_model: string | null;
  readonly reasoning: string | null;
  readonly created_at: string;
}

interface AccessExecutionListResponse {
  readonly data: readonly AccessExecutionResponse[];
  readonly pagination: {
    readonly cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
}

interface AccessExecutionDetailResponse {
  readonly data: {
    readonly execution: AccessExecutionResponse;
    readonly events: readonly AccessEventResponse[];
    readonly evaluations: readonly AccessEvaluationResponse[];
    readonly reflections: readonly AccessReflectionResponse[];
  };
}

function parseJsonField(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string") {
    return value ?? fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toNullableString(value: unknown): string | null {
  return value != null && value !== "" ? String(value) : null;
}

function toNullableNumber(value: unknown): number | null {
  return value != null ? Number(value) : null;
}

async function requiresAnonymization(
  db: D1Database,
  agentId: string | null,
  cache: Map<string, boolean>
): Promise<boolean> {
  if (agentId === null) {
    return true;
  }

  const cached = cache.get(agentId);
  if (cached !== undefined) {
    return cached;
  }

  const row = await db
    .prepare(
      `SELECT requires_anonymization
       FROM consent_policies
       WHERE agent_id = ?1
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .bind(agentId)
    .first<{ requires_anonymization: number }>();

  const anonymize = row ? row.requires_anonymization === 1 : true;
  cache.set(agentId, anonymize);
  return anonymize;
}

function toAccessExecutionResponse(
  row: Record<string, unknown>,
  anonymize: boolean
): AccessExecutionResponse {
  const metadata = parseJsonField(
    row["metadata"],
    {}
  ) as Record<string, unknown>;
  const error = toNullableString(row["error"]);

  return {
    id: String(row["id"]),
    agent_id: toNullableString(row["agent_id"]),
    status: String(row["status"]),
    model: toNullableString(row["model"]),
    provider: toNullableString(row["provider"]),
    trace_id: toNullableString(row["trace_id"]),
    started_at: toNullableString(row["started_at"]),
    completed_at: toNullableString(row["completed_at"]),
    latency_ms: toNullableNumber(row["latency_ms"]),
    input_tokens: toNullableNumber(row["input_tokens"]),
    output_tokens: toNullableNumber(row["output_tokens"]),
    total_tokens: toNullableNumber(row["total_tokens"]),
    estimated_cost: toNullableNumber(row["estimated_cost"]),
    error: anonymize && error !== null ? redactString(error) : error,
    created_at: String(row["created_at"]),
    metadata: anonymize
      ? (redactPayload(metadata) as Record<string, unknown>)
      : metadata,
  };
}

function toAccessEventResponse(
  row: Record<string, unknown>,
  anonymize: boolean
): AccessEventResponse {
  const payload = parseJsonField(
    row["payload"],
    {}
  ) as Record<string, unknown>;
  const metadata = parseJsonField(
    row["metadata"],
    {}
  ) as Record<string, unknown>;

  return {
    id: String(row["id"]),
    execution_id: String(row["execution_id"]),
    event_type: String(row["event_type"]),
    service: toNullableString(row["service"]),
    payload: anonymize
      ? (redactPayload(payload) as Record<string, unknown>)
      : payload,
    metadata: anonymize
      ? (redactPayload(metadata) as Record<string, unknown>)
      : metadata,
    timestamp: String(row["timestamp"]),
    schema_version: String(row["schema_version"]),
  };
}

function toAccessEvaluationResponse(
  row: Record<string, unknown>,
  anonymize: boolean
): AccessEvaluationResponse {
  const details = parseJsonField(
    row["details"],
    {}
  ) as Record<string, unknown>;
  const summary = toNullableString(row["summary"]);

  return {
    id: String(row["id"]),
    execution_id: String(row["execution_id"]),
    accuracy: toNullableNumber(row["accuracy"]),
    goal_completion: toNullableNumber(row["goal_completion"]),
    hallucination_score: toNullableNumber(row["hallucination_score"]),
    confidence: toNullableNumber(row["confidence"]),
    cost_efficiency: toNullableNumber(row["cost_efficiency"]),
    latency_score: toNullableNumber(row["latency_score"]),
    safety_score: toNullableNumber(row["safety_score"]),
    evaluation_model: toNullableString(row["evaluation_model"]),
    summary: anonymize && summary !== null ? redactString(summary) : summary,
    details: anonymize
      ? (redactPayload(details) as Record<string, unknown>)
      : details,
    created_at: String(row["created_at"]),
  };
}

function toAccessReflectionResponse(
  row: Record<string, unknown>,
  anonymize: boolean
): AccessReflectionResponse {
  const strengths = parseJsonField(row["strengths"], []) as unknown[];
  const weaknesses = parseJsonField(row["weaknesses"], []) as unknown[];
  const recommendations = parseJsonField(
    row["recommendations"],
    []
  ) as unknown[];
  const summary = toNullableString(row["summary"]);
  const reasoning = toNullableString(row["reasoning"]);

  return {
    id: String(row["id"]),
    execution_id: String(row["execution_id"]),
    summary: anonymize && summary !== null ? redactString(summary) : summary,
    strengths: anonymize
      ? (redactPayload(strengths) as unknown[])
      : strengths,
    weaknesses: anonymize
      ? (redactPayload(weaknesses) as unknown[])
      : weaknesses,
    recommendations: anonymize
      ? (redactPayload(recommendations) as unknown[])
      : recommendations,
    confidence: toNullableNumber(row["confidence"]),
    reflection_model: toNullableString(row["reflection_model"]),
    reasoning:
      anonymize && reasoning !== null ? redactString(reasoning) : reasoning,
    created_at: String(row["created_at"]),
  };
}

accessExecutions.get(
  "/",
  validate({ query: listExecutionsQuerySchema }),
  async (c) => {
    const grant = getAccessGrant(c);
    if (!grant) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or missing access credential",
          },
        },
        401
      );
    }

    const db = c.env.DB;
    if (!db) {
      return c.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database unavailable",
          },
        },
        503
      );
    }

    const parsedQuery = listExecutionsQuerySchema.safeParse(c.req.query());
    if (!parsedQuery.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
          },
        },
        400
      );
    }

    const query = parsedQuery.data;
    const limit = query.limit ?? 10;
    const scopedAgents = grant.agent_ids;

    const where: string[] = ["organization_id = ?1", "deleted_at IS NULL"];
    const params: unknown[] = [grant.organization_id];
    let paramIndex = 2;

    if (query.agent_id) {
      if (scopedAgents.length > 0 && !scopedAgents.includes(query.agent_id)) {
        return c.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Agent not included in access grant",
            },
          },
          403
        );
      }

      where.push(`agent_id = ?${paramIndex}`);
      params.push(query.agent_id);
      paramIndex++;
    } else if (scopedAgents.length > 0) {
      const placeholders = scopedAgents
        .map((_, index) => `?${paramIndex + index}`)
        .join(", ");
      where.push(`agent_id IN (${placeholders})`);
      params.push(...scopedAgents);
      paramIndex += scopedAgents.length;
    }

    if (query.status) {
      where.push(`status = ?${paramIndex}`);
      params.push(query.status);
      paramIndex++;
    }

    if (query.cursor) {
      where.push(`created_at < ?${paramIndex}`);
      params.push(query.cursor);
      paramIndex++;
    }

    const rows = await db
      .prepare(
        `SELECT * FROM executions
         WHERE ${where.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT ?${paramIndex}`
      )
      .bind(...params, limit + 1)
      .all<Record<string, unknown>>();

    const hasMore = rows.results.length > limit;
    const page = rows.results.slice(0, limit);
    const consentCache = new Map<string, boolean>();
    const items: AccessExecutionResponse[] = [];

    for (const row of page) {
      const agentId = toNullableString(row["agent_id"]);
      const anonymize = await requiresAnonymization(db, agentId, consentCache);
      items.push(toAccessExecutionResponse(row, anonymize));
    }

    const nextCursor =
      hasMore && items.length > 0
        ? (items[items.length - 1]?.created_at ?? null)
        : null;

    await recordAccessAudit(db, {
      grantId: grant.id,
      organizationId: grant.organization_id,
      agentId: query.agent_id ?? undefined,
      method: "GET",
      path: "/v1/access/executions",
      rowsReturned: items.length,
      ip: c.req.header("CF-Connecting-IP") ?? undefined,
      userAgent: c.req.header("User-Agent") ?? undefined,
    });

    const response: AccessExecutionListResponse = {
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

accessExecutions.get(
  "/:id",
  validate({ param: executionParamsSchema }),
  async (c) => {
    const grant = getAccessGrant(c);
    if (!grant) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or missing access credential",
          },
        },
        401
      );
    }

    const db = c.env.DB;
    if (!db) {
      return c.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database unavailable",
          },
        },
        503
      );
    }

    const parsedParams = executionParamsSchema.safeParse(c.req.param());
    if (!parsedParams.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid path parameters",
          },
        },
        400
      );
    }

    const { id } = parsedParams.data;

    const execution = await db
      .prepare(
        `SELECT * FROM executions
         WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
      )
      .bind(id, grant.organization_id)
      .first<Record<string, unknown>>();

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

    const agentId = toNullableString(execution["agent_id"]);
    if (
      grant.agent_ids.length > 0 &&
      (agentId === null || !grant.agent_ids.includes(agentId))
    ) {
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

    const anonymize = await requiresAnonymization(
      db,
      agentId,
      new Map<string, boolean>()
    );

    const [eventRows, evaluationRows, reflectionRows] = await Promise.all([
      db
        .prepare(
          `SELECT * FROM events
           WHERE execution_id = ?1
           ORDER BY timestamp ASC`
        )
        .bind(id)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT * FROM evaluations
           WHERE execution_id = ?1
           ORDER BY created_at ASC`
        )
        .bind(id)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT * FROM reflections
           WHERE execution_id = ?1
           ORDER BY created_at ASC`
        )
        .bind(id)
        .all<Record<string, unknown>>(),
    ]);

    const eventItems = eventRows.results.map((row) =>
      toAccessEventResponse(row, anonymize)
    );

    await recordAccessAudit(db, {
      grantId: grant.id,
      organizationId: grant.organization_id,
      agentId: agentId ?? undefined,
      method: "GET",
      path: "/v1/access/executions/:id",
      rowsReturned: 1 + eventItems.length,
      ip: c.req.header("CF-Connecting-IP") ?? undefined,
      userAgent: c.req.header("User-Agent") ?? undefined,
    });

    const response: AccessExecutionDetailResponse = {
      data: {
        execution: toAccessExecutionResponse(execution, anonymize),
        events: eventItems,
        evaluations: evaluationRows.results.map((row) =>
          toAccessEvaluationResponse(row, anonymize)
        ),
        reflections: reflectionRows.results.map((row) =>
          toAccessReflectionResponse(row, anonymize)
        ),
      },
    };

    return c.json(response, 200);
  }
);

export { accessExecutions as accessExecutionRoutes };
