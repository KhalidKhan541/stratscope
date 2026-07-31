import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const consent = new Hono<{ Bindings: Env }>();

const consentParamsSchema = z.object({
  id: z.string().min(1),
});

const createConsentBodySchema = z.object({
  project_id: z.string().min(1, "project_id is required"),
  agent_id: z.string().min(1, "agent_id is required"),
  scope: z.string().min(1, "scope is required").max(100),
  allowed_use_cases: z.array(z.string()).min(1, "allowed_use_cases is required"),
  retention_days: z.number().int().min(1),
  requires_anonymization: z.boolean(),
});

const updateConsentBodySchema = z.object({
  scope: z.string().min(1).max(100).optional(),
  allowed_use_cases: z.array(z.string()).optional(),
  retention_days: z.number().int().min(1).optional(),
  requires_anonymization: z.boolean().optional(),
});

interface ConsentResponse {
  readonly id: string;
  readonly project_id: string;
  readonly agent_id: string;
  readonly organization_id: string;
  readonly scope: string;
  readonly allowed_use_cases: string[];
  readonly retention_days: number;
  readonly requires_anonymization: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

function toConsentResponse(row: Record<string, unknown>): ConsentResponse {
  return {
    id: row["id"] as string,
    project_id: row["project_id"] as string,
    agent_id: row["agent_id"] as string,
    organization_id: row["organization_id"] as string,
    scope: row["scope"] as string,
    allowed_use_cases: JSON.parse((row["allowed_use_cases"] as string) ?? "[]"),
    retention_days: row["retention_days"] as number,
    requires_anonymization: (row["requires_anonymization"] as number) === 1,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

consent.post(
  "/",
  validate({ body: createConsentBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    const project = await c.env.DB.prepare(
      `SELECT id FROM projects WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(body.project_id, auth.organizationId)
      .first<{ id: string }>();

    if (!project) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Project with id '${body.project_id}' not found`,
          },
        },
        404
      );
    }

    const agent = await c.env.DB.prepare(
      `SELECT id FROM agents WHERE id = ?1 AND project_id = ?2 AND deleted_at IS NULL`
    )
      .bind(body.agent_id, body.project_id)
      .first<{ id: string }>();

    if (!agent) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Agent with id '${body.agent_id}' not found`,
          },
        },
        404
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO consent_policies (id, project_id, agent_id, organization_id, scope, allowed_use_cases, retention_days, requires_anonymization, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
      .bind(
        id,
        body.project_id,
        body.agent_id,
        auth.organizationId,
        body.scope,
        JSON.stringify(body.allowed_use_cases),
        body.retention_days,
        body.requires_anonymization ? 1 : 0,
        now,
        now
      )
      .run();

    const response: ConsentResponse = {
      id,
      project_id: body.project_id,
      agent_id: body.agent_id,
      organization_id: auth.organizationId!,
      scope: body.scope,
      allowed_use_cases: body.allowed_use_cases,
      retention_days: body.retention_days,
      requires_anonymization: body.requires_anonymization,
      created_at: now,
      updated_at: now,
    };

    return c.json(response, 201);
  }
);

consent.get("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM consent_policies WHERE organization_id = ?1 AND created_at < ?2 ORDER BY created_at DESC LIMIT ?3`
    : `SELECT * FROM consent_policies WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2`;
  const params = cursor
    ? [auth.organizationId, cursor, limit + 1]
    : [auth.organizationId, limit + 1];

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const items = (rows.results ?? []).map(toConsentResponse);
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  return c.json({
    data: sliced,
    pagination: {
      cursor: hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.created_at : null,
      has_more: hasMore,
      total_count: sliced.length,
    },
  });
});

consent.get(
  "/:id",
  validate({ param: consentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM consent_policies WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Consent policy with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toConsentResponse(row), 200);
  }
);

consent.patch(
  "/:id",
  validate({ param: consentParamsSchema, body: updateConsentBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id FROM consent_policies WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Consent policy with id '${id}' not found`,
          },
        },
        404
      );
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.scope !== undefined) {
      setClauses.push(`scope = ?${paramIndex}`);
      params.push(body.scope);
      paramIndex++;
    }

    if (body.allowed_use_cases !== undefined) {
      setClauses.push(`allowed_use_cases = ?${paramIndex}`);
      params.push(JSON.stringify(body.allowed_use_cases));
      paramIndex++;
    }

    if (body.retention_days !== undefined) {
      setClauses.push(`retention_days = ?${paramIndex}`);
      params.push(body.retention_days);
      paramIndex++;
    }

    if (body.requires_anonymization !== undefined) {
      setClauses.push(`requires_anonymization = ?${paramIndex}`);
      params.push(body.requires_anonymization ? 1 : 0);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "No fields to update",
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    setClauses.push(`updated_at = '${now}'`);

    await c.env.DB.prepare(
      `UPDATE consent_policies SET ${setClauses.join(", ")} WHERE id = ?${paramIndex}`
    )
      .bind(...params, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM consent_policies WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated consent policy",
          },
        },
        500
      );
    }

    return c.json(toConsentResponse(row), 200);
  }
);

export { consent as consentRoutes };
