import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const researchAgents = new Hono<{ Bindings: Env }>();

const researchAgentParamsSchema = z.object({
  id: z.string().min(1),
});

const RESEARCH_AGENT_TYPE_ENUM = z.enum([
  "data_collector",
  "analyzer",
  "evaluator",
  "synthesizer",
  "custom",
]);

const createResearchAgentBodySchema = z.object({
  project_id: z.string().min(1, "project_id is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  agent_type: RESEARCH_AGENT_TYPE_ENUM,
  config: z.record(z.unknown()).optional(),
  capabilities: z.array(z.string()).optional(),
});

const updateResearchAgentBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  agent_type: RESEARCH_AGENT_TYPE_ENUM.optional(),
  config: z.record(z.unknown()).optional(),
  capabilities: z.array(z.string()).optional(),
});

interface ResearchAgentResponse {
  readonly id: string;
  readonly project_id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly agent_type: string;
  readonly status: string;
  readonly config: Record<string, unknown>;
  readonly capabilities: string[];
  readonly created_at: string;
  readonly updated_at: string;
}

function toResearchAgentResponse(row: Record<string, unknown>): ResearchAgentResponse {
  let config: Record<string, unknown> = {};
  if (typeof row["config"] === "string") {
    try {
      config = JSON.parse(row["config"]) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }

  return {
    id: row["id"] as string,
    project_id: row["project_id"] as string,
    organization_id: row["organization_id"] as string,
    name: row["name"] as string,
    description: (row["description"] as string) ?? null,
    agent_type: row["agent_type"] as string,
    status: row["status"] as string,
    config,
    capabilities: JSON.parse((row["capabilities"] as string) ?? "[]"),
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

researchAgents.post(
  "/",
  validate({ body: createResearchAgentBodySchema }),
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

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO research_agents (id, project_id, organization_id, name, description, agent_type, status, config, capabilities, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
      .bind(
        id,
        body.project_id,
        auth.organizationId,
        body.name,
        body.description ?? null,
        body.agent_type,
        "inactive",
        JSON.stringify(body.config ?? {}),
        JSON.stringify(body.capabilities ?? []),
        now,
        now
      )
      .run();

    const response: ResearchAgentResponse = {
      id,
      project_id: body.project_id,
      organization_id: auth.organizationId!,
      name: body.name,
      description: body.description ?? null,
      agent_type: body.agent_type,
      status: "inactive",
      config: body.config ?? {},
      capabilities: body.capabilities ?? [],
      created_at: now,
      updated_at: now,
    };

    return c.json(response, 201);
  }
);

researchAgents.get("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM research_agents WHERE organization_id = ?1 AND created_at < ?2 ORDER BY created_at DESC LIMIT ?3`
    : `SELECT * FROM research_agents WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2`;
  const params = cursor
    ? [auth.organizationId, cursor, limit + 1]
    : [auth.organizationId, limit + 1];

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const items = (rows.results ?? []).map(toResearchAgentResponse);
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

researchAgents.get(
  "/:id",
  validate({ param: researchAgentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM research_agents WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Research agent with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toResearchAgentResponse(row), 200);
  }
);

researchAgents.patch(
  "/:id",
  validate({ param: researchAgentParamsSchema, body: updateResearchAgentBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id FROM research_agents WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Research agent with id '${id}' not found`,
          },
        },
        404
      );
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      setClauses.push(`name = ?${paramIndex}`);
      params.push(body.name);
      paramIndex++;
    }

    if (body.description !== undefined) {
      setClauses.push(`description = ?${paramIndex}`);
      params.push(body.description);
      paramIndex++;
    }

    if (body.agent_type !== undefined) {
      setClauses.push(`agent_type = ?${paramIndex}`);
      params.push(body.agent_type);
      paramIndex++;
    }

    if (body.config !== undefined) {
      setClauses.push(`config = ?${paramIndex}`);
      params.push(JSON.stringify(body.config));
      paramIndex++;
    }

    if (body.capabilities !== undefined) {
      setClauses.push(`capabilities = ?${paramIndex}`);
      params.push(JSON.stringify(body.capabilities));
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
      `UPDATE research_agents SET ${setClauses.join(", ")} WHERE id = ?${paramIndex}`
    )
      .bind(...params, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM research_agents WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated research agent",
          },
        },
        500
      );
    }

    return c.json(toResearchAgentResponse(row), 200);
  }
);

researchAgents.post(
  "/:id/activate",
  validate({ param: researchAgentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM research_agents WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Research agent with id '${id}' not found`,
          },
        },
        404
      );
    }

    if (existing.status === "active") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "Research agent is already active",
          },
        },
        409
      );
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE research_agents SET status = ?1, updated_at = ?2 WHERE id = ?3`
    )
      .bind("active", now, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM research_agents WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    return c.json(toResearchAgentResponse(row!), 200);
  }
);

researchAgents.post(
  "/:id/suspend",
  validate({ param: researchAgentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM research_agents WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Research agent with id '${id}' not found`,
          },
        },
        404
      );
    }

    if (existing.status === "inactive") {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "Research agent is already inactive",
          },
        },
        409
      );
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE research_agents SET status = ?1, updated_at = ?2 WHERE id = ?3`
    )
      .bind("inactive", now, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM research_agents WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    return c.json(toResearchAgentResponse(row!), 200);
  }
);

export { researchAgents as researchAgentRoutes };
