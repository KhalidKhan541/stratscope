/**
 * Dashboard routes — session-authenticated, organization-scoped reads
 * for the logged-in user's agent activity after OAuth login.
 *
 * Mounted under /v1/me. Every endpoint is scoped to the organization
 * resolved from the session token by sessionAuth.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import { sessionAuth, getSessionUser } from "../../middleware/sessionAuth.js";

const me = new Hono<{ Bindings: Env }>();

me.use("*", sessionAuth);

const EXECUTION_STATUSES = [
  "created",
  "accepted",
  "running",
  "completed",
  "failed",
  "cancelled",
  "archived",
] as const;

const meExecutionsQuerySchema = z.object({
  agent_id: z.string().min(1).optional(),
  status: z.enum(EXECUTION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const meEventsQuerySchema = z.object({
  execution_id: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

function getDb(c: { env: Env }): D1Database | null {
  return c.env.DB ?? null;
}

function parseJsonField(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string" || value === "") {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  const parsed = raw ? Number(raw) : fallback;
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(safe, 1), max);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

me.get("/stats", async (c) => {
  const db = getDb(c);
  if (!db) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } },
      503
    );
  }

  const user = getSessionUser(c);
  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total_executions,
              SUM(status = 'completed') AS completed,
              SUM(status = 'failed') AS failed,
              AVG(latency_ms) AS avg_latency_ms,
              SUM(estimated_cost) AS total_cost_usd,
              SUM(total_tokens) AS total_tokens
       FROM executions
       WHERE organization_id = ?1 AND deleted_at IS NULL`
    )
    .bind(user.organizationId)
    .first<{
      total_executions: number;
      completed: number | null;
      failed: number | null;
      avg_latency_ms: number | null;
      total_cost_usd: number | null;
      total_tokens: number | null;
    }>();

  const activeAgents = await db
    .prepare(
      `SELECT COUNT(DISTINCT agent_id) AS count
       FROM executions
       WHERE organization_id = ?1 AND deleted_at IS NULL`
    )
    .bind(user.organizationId)
    .first<{ count: number }>();

  const eventsCount = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM events e
       JOIN executions x ON x.id = e.execution_id
       WHERE x.organization_id = ?1 AND x.deleted_at IS NULL`
    )
    .bind(user.organizationId)
    .first<{ count: number }>();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - 6);

  const buckets: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);
    buckets.push(day.toISOString().slice(0, 10));
  }

  const counts = new Map<string, number>(buckets.map((bucket) => [bucket, 0]));

  const createdRows = await db
    .prepare(
      `SELECT created_at
       FROM executions
       WHERE organization_id = ?1 AND created_at >= ?2 AND deleted_at IS NULL`
    )
    .bind(user.organizationId, cutoff.toISOString())
    .all<{ created_at: string }>();

  for (const r of createdRows.results) {
    const day = r.created_at.slice(0, 10);
    if (counts.has(day)) {
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }

  const totalExecutions = Number(row?.total_executions ?? 0);
  const completed = Number(row?.completed ?? 0);
  const failed = Number(row?.failed ?? 0);
  const successRate = totalExecutions > 0 ? roundTo((completed / totalExecutions) * 100, 1) : 0;
  const avgLatencyMs = Math.round(Number(row?.avg_latency_ms ?? 0));
  const totalCostUsd = roundTo(Number(row?.total_cost_usd ?? 0), 4);
  const totalTokens = Number(row?.total_tokens ?? 0);

  return c.json({
    data: {
      total_executions: totalExecutions,
      completed,
      failed,
      success_rate: successRate,
      avg_latency_ms: avgLatencyMs,
      total_cost_usd: totalCostUsd,
      total_tokens: totalTokens,
      active_agents: Number(activeAgents?.count ?? 0),
      executions_last_7d: buckets.map((bucket) => counts.get(bucket) ?? 0),
      events_count: Number(eventsCount?.count ?? 0),
    },
  });
});

interface AgentRow {
  id: string;
  name: string;
  model: string | null;
  framework: string | null;
  executions: number;
  completed: number | null;
  failed: number | null;
  avg_latency: number | null;
  total_cost: number | null;
  last_execution_at: string | null;
}

me.get("/agents", async (c) => {
  const db = getDb(c);
  if (!db) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } },
      503
    );
  }

  const user = getSessionUser(c);
  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const rows = await db
    .prepare(
      `SELECT a.id, a.name, a.model, a.framework,
              COUNT(e.id) AS executions,
              SUM(e.status = 'completed') AS completed,
              SUM(e.status = 'failed') AS failed,
              AVG(e.latency_ms) AS avg_latency,
              SUM(e.estimated_cost) AS total_cost,
              MAX(e.created_at) AS last_execution_at
       FROM agents a
       LEFT JOIN executions e ON e.agent_id = a.id AND e.deleted_at IS NULL
       WHERE a.project_id IN (SELECT id FROM projects WHERE organization_id = ?1 AND deleted_at IS NULL)
         AND a.deleted_at IS NULL
       GROUP BY a.id
       ORDER BY last_execution_at DESC`
    )
    .bind(user.organizationId)
    .all<AgentRow>();

  if (rows.results.length === 0) {
    return c.json({ data: [] });
  }

  const placeholders = rows.results.map((_, index) => `?${index + 2}`).join(", ");

  const statusRows = await db
    .prepare(
      `SELECT e.agent_id, e.status
       FROM executions e
       JOIN (
         SELECT agent_id, MAX(created_at) AS latest
         FROM executions
         WHERE organization_id = ?1 AND deleted_at IS NULL
         GROUP BY agent_id
       ) l ON l.agent_id = e.agent_id AND l.latest = e.created_at
       WHERE e.organization_id = ?1 AND e.deleted_at IS NULL
         AND e.agent_id IN (${placeholders})`
    )
    .bind(user.organizationId, ...rows.results.map((r) => r.id))
    .all<{ agent_id: string; status: string }>();

  const latestStatus = new Map<string, string>();
  for (const s of statusRows.results) {
    latestStatus.set(s.agent_id, s.status);
  }

  const agents = rows.results.map((row) => {
    const executions = Number(row.executions);
    const completed = Number(row.completed ?? 0);
    return {
      id: row.id,
      name: row.name,
      model: row.model,
      framework: row.framework,
      executions,
      completed,
      failed: Number(row.failed ?? 0),
      success_rate: executions > 0 ? roundTo((completed / executions) * 100, 1) : 0,
      avg_latency_ms: Math.round(Number(row.avg_latency ?? 0)),
      total_cost_usd: roundTo(Number(row.total_cost ?? 0), 4),
      last_execution_at: row.last_execution_at,
      last_status: latestStatus.get(row.id) ?? null,
    };
  });

  return c.json({ data: agents });
});

interface ExecutionRow {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  status: string;
  model: string | null;
  provider: string | null;
  trace_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  error: string | null;
  created_at: string;
  metadata: string | null;
}

me.get(
  "/executions",
  validate({ query: meExecutionsQuerySchema }),
  async (c) => {
    const db = getDb(c);
    if (!db) {
      return c.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } },
        503
      );
    }

    const user = getSessionUser(c);
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
    }

    const agentId = c.req.query("agent_id") ?? null;
    const status = c.req.query("status") ?? null;
    const limit = parseLimit(c.req.query("limit"), 20, 100);

    const conditions = ["e.organization_id = ?1", "e.deleted_at IS NULL"];
    const params: Array<string | number> = [user.organizationId];

    if (agentId) {
      params.push(agentId);
      conditions.push(`agent_id = ?${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`status = ?${params.length}`);
    }

    params.push(limit);

    const rows = await db
      .prepare(
        `SELECT e.id, e.agent_id, e.status, e.model, e.provider, e.trace_id,
                e.started_at, e.completed_at, e.latency_ms, e.input_tokens,
                e.output_tokens, e.total_tokens, e.estimated_cost, e.error,
                e.created_at, e.metadata,
                a.name AS agent_name
         FROM executions e
         LEFT JOIN agents a ON a.id = e.agent_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY e.created_at DESC
         LIMIT ?${params.length}`
      )
      .bind(...params)
      .all<ExecutionRow>();

    const executions = rows.results.map((row) => ({
      id: row.id,
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      status: row.status,
      model: row.model,
      provider: row.provider,
      trace_id: row.trace_id,
      started_at: row.started_at,
      completed_at: row.completed_at,
      latency_ms: row.latency_ms,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      total_tokens: row.total_tokens,
      estimated_cost: row.estimated_cost,
      error: row.error,
      created_at: row.created_at,
      metadata: parseJsonField(row.metadata, {}),
    }));

    return c.json({ data: executions });
  }
);

interface EventRow {
  id: string;
  event_type: string;
  service: string | null;
  payload: string | null;
  metadata: string | null;
  timestamp: string;
  schema_version: string | null;
}

me.get(
  "/events",
  validate({ query: meEventsQuerySchema }),
  async (c) => {
    const db = getDb(c);
    if (!db) {
      return c.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured" } },
        503
      );
    }

    const user = getSessionUser(c);
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
    }

    const executionId = c.req.query("execution_id") ?? "";
    const limit = parseLimit(c.req.query("limit"), 100, 500);

    const execution = await db
      .prepare(
        `SELECT id
         FROM executions
         WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
      )
      .bind(executionId, user.organizationId)
      .first<{ id: string }>();

    if (!execution) {
      return c.json({ error: { code: "NOT_FOUND", message: "Execution not found" } }, 404);
    }

    const rows = await db
      .prepare(
        `SELECT id, event_type, service, payload, metadata, timestamp, schema_version
         FROM events
         WHERE execution_id = ?1
         ORDER BY timestamp ASC
         LIMIT ?2`
      )
      .bind(executionId, limit)
      .all<EventRow>();

    const events = rows.results.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      service: row.service,
      payload: parseJsonField(row.payload, {}),
      metadata: parseJsonField(row.metadata, {}),
      timestamp: row.timestamp,
      schema_version: row.schema_version,
    }));

    return c.json({ data: events });
  }
);

export { me as meRoutes };
