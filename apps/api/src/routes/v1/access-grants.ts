/**
 * Access grant management routes.
 *
 * Owner-side endpoints for issuing, listing, and revoking read-only
 * access grants (mag_ credentials) issued to external data consumers.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import { apiKeyAuth } from "../../middleware/apiKeyAuth.js";
import { resolveOwnerContext } from "../../lib/ownerContext.js";
import {
  issueAccessGrant,
  listAccessGrants,
  revokeAccessGrant,
  getAccessGrantById,
} from "../../lib/accessGrants.js";

const accessGrants = new Hono<{ Bindings: Env }>();

accessGrants.use("*", apiKeyAuth);

const createGrantSchema = z.object({
  name: z.string().min(1).max(100),
  agent_ids: z.array(z.string().min(1)).min(1).max(50),
});

const grantIdParamSchema = z.object({
  id: z.string().min(1),
});

accessGrants.post(
  "/grants",
  validate({ body: createGrantSchema }),
  async (c) => {
    if (!c.env.DB) {
      return c.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
        503
      );
    }

    const ctx = await resolveOwnerContext(c);
    if (!ctx) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Valid owner API key required" } },
        401
      );
    }

    const body = (await c.req.json()) as z.infer<typeof createGrantSchema>;
    const agentIds = [...new Set(body.agent_ids)];

    const placeholders = agentIds.map((_, i) => `?${i + 1}`).join(", ");
    const agentRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM agents WHERE id IN (${placeholders})`
    )
      .bind(...agentIds)
      .first<{ count: number }>();

    if (!agentRow || agentRow.count !== agentIds.length) {
      return c.json(
        { error: { code: "INVALID_AGENT", message: "One or more agent_ids do not exist" } },
        400
      );
    }

    const issued = await issueAccessGrant(c.env.DB, {
      organizationId: ctx.organizationId,
      name: body.name,
      agentIds,
      createdBy: ctx.keyId,
    });

    const { organization_id, ...grant } = issued.grant;

    return c.json(
      {
        data: {
          grant,
          credential: issued.credential,
          warning: "Save this credential — it is shown only once",
        },
      },
      201
    );
  }
);

accessGrants.get("/grants", async (c) => {
  if (!c.env.DB) {
    return c.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
      503
    );
  }

  const ctx = await resolveOwnerContext(c);
  if (!ctx) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Valid owner API key required" } },
      401
    );
  }

  const grants = await listAccessGrants(c.env.DB, ctx.organizationId);

  const usageRows = await c.env.DB.prepare(
    `SELECT grant_id, COUNT(*) AS requests, COALESCE(SUM(rows_returned), 0) AS rows_returned
     FROM access_audit
     WHERE organization_id = ?1
     GROUP BY grant_id`
  )
    .bind(ctx.organizationId)
    .all<{ grant_id: string; requests: number; rows_returned: number }>();

  const usage = new Map(
    usageRows.results.map((row) => [
      row.grant_id,
      { requests: Number(row.requests ?? 0), rows_returned: Number(row.rows_returned ?? 0) },
    ])
  );

  const data = grants.map((grant) => {
    const { organization_id, ...view } = grant;
    const grantUsage = usage.get(grant.id);
    return {
      ...view,
      requests: grantUsage?.requests ?? 0,
      rows_returned: grantUsage?.rows_returned ?? 0,
    };
  });

  return c.json({ data });
});

accessGrants.delete(
  "/grants/:id",
  validate({ param: grantIdParamSchema }),
  async (c) => {
    if (!c.env.DB) {
      return c.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } },
        503
      );
    }

    const ctx = await resolveOwnerContext(c);
    if (!ctx) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Valid owner API key required" } },
        401
      );
    }

    const grantId = c.req.param("id") ?? "";
    const grant = await getAccessGrantById(c.env.DB, grantId);

    if (!grant || grant.organization_id !== ctx.organizationId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Access grant not found" } },
        404
      );
    }

    await revokeAccessGrant(c.env.DB, grantId, ctx.keyId);

    return c.json({ data: { id: grantId, status: "revoked" } }, 200);
  }
);

export { accessGrants as accessGrantRoutes };
