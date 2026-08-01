import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import { apiKeyAuth, getApiKeyAuth } from "../../middleware/apiKeyAuth.js";
import { redactPayload, redactString } from "../../lib/redact.js";

const ingest = new Hono<{ Bindings: Env }>();

ingest.use("*", apiKeyAuth);

const ingestExecutionSchema = z.object({
  project_id: z.string().min(1),
  agent_id: z.string().min(1),
  model: z.string().optional(),
  provider: z.string().optional(),
  trace_id: z.string().optional(),
  parent_execution_id: z.string().optional(),
  sdk_version: z.string().optional(),
  pipeline_version: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ingestEventSchema = z.object({
  event_type: z.string().min(1),
  execution_id: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ingestBatchSchema = z.object({
  batch: z.array(ingestEventSchema).min(1).max(500),
});

const ingestExecutionParamsSchema = z.object({
  id: z.string().min(1),
});

const ingestExecutionUpdateSchema = z.object({
  status: z.enum(["completed", "failed"]),
  latency_ms: z.number().optional(),
  cost_usd: z.number().optional(),
  tokens_in: z.number().optional(),
  tokens_out: z.number().optional(),
  error: z.string().optional(),
  completed_at: z.string().optional(),
});

interface KeyContext {
  readonly keyId: string;
  readonly projectId: string;
  readonly organizationId: string;
}

async function resolveKeyContext(c: { env: Env }): Promise<KeyContext | null> {
  if (!c.env.DB) {
    return null;
  }

  const auth = getApiKeyAuth(c as Parameters<typeof getApiKeyAuth>[0]);
  if (!auth) {
    return null;
  }

  const row = await c.env.DB.prepare(
    `SELECT k.id AS key_id, k.project_id, p.organization_id
     FROM api_keys k
     JOIN projects p ON p.id = k.project_id
     WHERE k.id = ?1 AND k.deleted_at IS NULL`
  )
    .bind(auth.id)
    .first<{ key_id: string; project_id: string; organization_id: string }>();

  if (!row) {
    return null;
  }

  return {
    keyId: row.key_id,
    projectId: row.project_id,
    organizationId: row.organization_id,
  };
}

async function loadConsentPolicy(
  c: { env: Env },
  ctx: KeyContext,
  agentId: string
): Promise<{ requires_anonymization: boolean; redact_fields: string[] }> {
  if (!c.env.DB) {
    return { requires_anonymization: true, redact_fields: [] };
  }

  const row = await c.env.DB.prepare(
    `SELECT requires_anonymization, allowed_use_cases
     FROM consent_policies
     WHERE project_id = ?1 AND agent_id = ?2
     ORDER BY updated_at DESC
     LIMIT 1`
  )
    .bind(ctx.projectId, agentId)
    .first<{ requires_anonymization: number; allowed_use_cases: string }>();

  if (!row) {
    return { requires_anonymization: true, redact_fields: [] };
  }

  return {
    requires_anonymization: row.requires_anonymization === 1,
    redact_fields: [],
  };
}

ingest.post(
  "/executions",
  validate({ body: ingestExecutionSchema }),
  async (c) => {
    const body = await c.req.json() as z.infer<typeof ingestExecutionSchema>;
    const ctx = await resolveKeyContext(c);
    if (!ctx) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
    }

    if (body.project_id !== ctx.projectId) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "API key is not scoped to this project" } },
        403
      );
    }

    if (!c.env.DB) {
      return c.json(
        { error: { code: "INTERNAL_ERROR", message: "Database unavailable" } },
        500
      );
    }

    const agent = await c.env.DB.prepare(
      `SELECT id FROM agents WHERE id = ?1 AND project_id = ?2 AND deleted_at IS NULL`
    )
      .bind(body.agent_id, ctx.projectId)
      .first<{ id: string }>();

    if (!agent) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Agent not found in this project" } },
        404
      );
    }

    const executionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const status = "running";

    await c.env.DB.prepare(
      `INSERT INTO executions (id, organization_id, project_id, agent_id, status, model, provider, trace_id, parent_execution_id, pipeline_version, sdk_version, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        executionId,
        ctx.organizationId,
        ctx.projectId,
        body.agent_id,
        status,
        body.model ?? "unknown",
        body.provider ?? "unknown",
        body.trace_id ?? null,
        body.parent_execution_id ?? null,
        body.pipeline_version ?? "1.0.0",
        body.sdk_version ?? "0.1.0",
        JSON.stringify(body.metadata ?? {}),
        now
      )
      .run();

    return c.json({ success: true, data: { id: executionId, trace_id: body.trace_id ?? executionId, status } }, 201);
  }
);

ingest.post(
  "/events",
  validate({ body: ingestBatchSchema }),
  async (c) => {
    const body = await c.req.json() as z.infer<typeof ingestBatchSchema>;
    const ctx = await resolveKeyContext(c);
    if (!ctx) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
    }

    if (!c.env.DB) {
      return c.json(
        { error: { code: "INTERNAL_ERROR", message: "Database unavailable" } },
        500
      );
    }

    const now = new Date().toISOString();
    const inserted: string[] = [];

    for (const event of body.batch) {
      const execution = await c.env.DB.prepare(
        `SELECT agent_id, project_id FROM executions WHERE id = ?1`
      )
        .bind(event.execution_id)
        .first<{ agent_id: string; project_id: string }>();

      if (!execution || execution.project_id !== ctx.projectId) {
        continue;
      }

      const consent = await loadConsentPolicy(c, ctx, execution.agent_id);
      const maxLen = consent.requires_anonymization ? 2000 : 10000;
      const payload = consent.requires_anonymization
        ? redactPayload(event.payload, { redactFields: consent.redact_fields, maxPayloadLength: maxLen })
        : event.payload;

      const id = crypto.randomUUID();

      await c.env.DB.prepare(
        `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          event.execution_id,
          event.event_type,
          "sdk",
          JSON.stringify(payload),
          JSON.stringify(event.metadata ?? {}),
          now,
          "1.0"
        )
        .run();

      inserted.push(id);
    }

    return c.json({ success: true, data: { inserted: inserted.length } }, 201);
  }
);

ingest.patch(
  "/executions/:id",
  validate({ param: ingestExecutionParamsSchema, body: ingestExecutionUpdateSchema }),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json() as z.infer<typeof ingestExecutionUpdateSchema>;
    const ctx = await resolveKeyContext(c);
    if (!ctx) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
    }

    if (!c.env.DB) {
      return c.json(
        { error: { code: "INTERNAL_ERROR", message: "Database unavailable" } },
        500
      );
    }

    const execution = await c.env.DB.prepare(
      `SELECT id, project_id, status FROM executions WHERE id = ?1`
    )
      .bind(id)
      .first<{ id: string; project_id: string; status: string }>();

    if (!execution) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Execution not found" } },
        404
      );
    }

    if (execution.project_id !== ctx.projectId) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "API key is not scoped to this execution" } },
        403
      );
    }

    const completedAt = body.completed_at ?? new Date().toISOString();

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    setClauses.push(`status = ?${paramIndex}`);
    params.push(body.status);
    paramIndex++;

    setClauses.push(`completed_at = ?${paramIndex}`);
    params.push(completedAt);
    paramIndex++;

    if (body.latency_ms !== undefined) {
      setClauses.push(`latency_ms = ?${paramIndex}`);
      params.push(body.latency_ms);
      paramIndex++;
    }

    if (body.cost_usd !== undefined) {
      setClauses.push(`estimated_cost = ?${paramIndex}`);
      params.push(body.cost_usd);
      paramIndex++;
    }

    if (body.tokens_in !== undefined) {
      setClauses.push(`input_tokens = ?${paramIndex}`);
      params.push(body.tokens_in);
      paramIndex++;
    }

    if (body.tokens_out !== undefined) {
      setClauses.push(`output_tokens = ?${paramIndex}`);
      params.push(body.tokens_out);
      paramIndex++;
    }

    if (body.tokens_in !== undefined && body.tokens_out !== undefined) {
      setClauses.push(`total_tokens = ?${paramIndex}`);
      params.push(body.tokens_in + body.tokens_out);
      paramIndex++;
    }

    if (body.error !== undefined) {
      setClauses.push(`error = ?${paramIndex}`);
      params.push(body.error);
      paramIndex++;
    }

    await c.env.DB.prepare(
      `UPDATE executions SET ${setClauses.join(", ")} WHERE id = ?${paramIndex} AND project_id = ?${paramIndex + 1}`
    )
      .bind(...params, id, ctx.projectId)
      .run();

    return c.json({ success: true, data: { id, status: body.status } }, 200);
  }
);

export { ingest as ingestRoutes };
