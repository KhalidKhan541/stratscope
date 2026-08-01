/**
 * Access audit routes (owner-only).
 *
 * Lets the organization owner review every read performed through access
 * grants and produce an invoice-ready usage summary per external consumer.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import { apiKeyAuth } from "../../middleware/apiKeyAuth.js";
import { resolveOwnerContext } from "../../lib/ownerContext.js";
import { listAccessAudit, summarizeAccessAudit } from "../../lib/accessAudit.js";

const accessAudit = new Hono<{ Bindings: Env }>();

accessAudit.use("*", apiKeyAuth);

const auditListQuerySchema = z.object({
  grant_id: z.string().optional(),
  agent_id: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const auditSummaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// Fee rate: $0.001 per row returned by an external consumer.
const FEE_PER_ROW_USD = 0.001;

accessAudit.get(
  "/audit",
  validate({ query: auditListQuerySchema }),
  async (c) => {
    const db = c.env.DB;
    if (!db) {
      return c.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
        503
      );
    }

    const ctx = await resolveOwnerContext(c);
    if (!ctx) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
        401
      );
    }

    const query = auditListQuerySchema.parse(c.req.query());

    if (query.grant_id) {
      const grant = await db
        .prepare(`SELECT id FROM access_grants WHERE id = ?1 AND organization_id = ?2`)
        .bind(query.grant_id, ctx.organizationId)
        .first<{ id: string }>();

      if (!grant) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Access grant not found" } },
          404
        );
      }
    }

    const { rows, nextCursor } = await listAccessAudit(db, {
      organizationId: ctx.organizationId,
      grantId: query.grant_id,
      agentId: query.agent_id,
      limit: query.limit,
      cursor: query.cursor,
    });

    return c.json({
      data: rows,
      pagination: { cursor: nextCursor, has_more: nextCursor !== null },
    });
  }
);

accessAudit.get(
  "/audit/summary",
  validate({ query: auditSummaryQuerySchema }),
  async (c) => {
    const db = c.env.DB;
    if (!db) {
      return c.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
        503
      );
    }

    const ctx = await resolveOwnerContext(c);
    if (!ctx) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
        401
      );
    }

    const query = auditSummaryQuerySchema.parse(c.req.query());

    const summaries = await summarizeAccessAudit(db, {
      organizationId: ctx.organizationId,
      from: query.from,
      to: query.to,
    });

    const data = summaries
      .slice()
      .sort((a, b) =>
        String(b.last_used_at ?? "").localeCompare(String(a.last_used_at ?? ""))
      )
      .map((summary) => ({
        grant_id: summary.grant_id,
        grant_name: summary.grant_name,
        requests: summary.requests,
        rows_returned: summary.rows_returned,
        agents_read: summary.agents_read,
        first_used_at: summary.first_used_at,
        last_used_at: summary.last_used_at,
        estimated_fee_usd:
          Math.round(summary.rows_returned * FEE_PER_ROW_USD * 100) / 100,
      }));

    return c.json({ data });
  }
);

export { accessAudit as accessAuditRoutes };
