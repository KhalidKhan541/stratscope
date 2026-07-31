import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";

const seeaExecutions = new Hono<{ Bindings: Env }>();

const executionEventSchema = z.object({
  execution_id: z.string().min(1),
  event_type: z.string().min(1),
  service: z.literal("seea"),
  payload: z.string(),
  metadata: z.string().optional(),
});

const executionRecordSchema = z.object({
  execution_id: z.string().min(1),
  task_id: z.string().min(1),
  task_type: z.string().min(1),
  task_title: z.string().min(1),
  model: z.string().min(1),
  status: z.string().min(1),
  duration_ms: z.number(),
  tokens_used: z.number(),
  cost_usd: z.number(),
  tools_used: z.array(z.string()),
  errors: z.array(z.string()),
  retry_count: z.number(),
  output: z.string(),
});

const datasetSchema = z.object({
  dataset_id: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  record_count: z.number().optional(),
  schema_hash: z.string().optional(),
  checksum: z.string().optional(),
});

seeaExecutions.post(
  "/events",
  validate({ body: executionEventSchema }),
  async (c) => {
    const body = c.req.valid("json") as any;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        body.execution_id,
        body.event_type,
        body.service,
        body.payload,
        body.metadata || "{}",
        now,
        "1.0"
      )
      .run();

    return c.json({ success: true, id }, 201);
  }
);

seeaExecutions.post(
  "/records",
  validate({ body: executionRecordSchema }),
  async (c) => {
    const body = c.req.valid("json") as any;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO executions (id, organization_id, project_id, agent_id, status, input, model, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        "",
        "",
        "seea-agent",
        body.status,
        JSON.stringify({
          task_id: body.task_id,
          task_type: body.task_type,
          task_title: body.task_title,
        }),
        body.model,
        JSON.stringify({
          duration_ms: body.duration_ms,
          tokens_used: body.tokens_used,
          cost_usd: body.cost_usd,
          tools_used: body.tools_used,
          errors: body.errors,
          retry_count: body.retry_count,
        }),
        now
      )
      .run();

    return c.json({ success: true, id }, 201);
  }
);

seeaExecutions.post(
  "/datasets",
  validate({ body: datasetSchema }),
  async (c) => {
    const body = c.req.valid("json") as any;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO dataset_versions (id, dataset_id, version, description, status, row_count, schema_hash, checksum, consent_verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        body.dataset_id || crypto.randomUUID(),
        body.version || "1.0.0",
        body.description || "SEEA execution dataset",
        "draft",
        body.record_count || 0,
        body.schema_hash || "",
        body.checksum || "",
        1,
        now
      )
      .run();

    return c.json({ success: true, id }, 201);
  }
);

export { seeaExecutions as seeaExecutionRoutes };
