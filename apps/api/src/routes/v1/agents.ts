/**
 * Agent routes — registration and management.
 *
 * Handles agent registration and CRUD operations within a project.
 * All routes are versioned under /v1/agents.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const agents = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const AGENT_FRAMEWORK_ENUM = z.enum([
  "langgraph",
  "crewai",
  "autogen",
  "openai_sdk",
  "custom",
]);

const agentParamsSchema = z.object({
  id: z.string().min(1),
});

const createAgentBodySchema = z.object({
  project_id: z.string().min(1, "project_id is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  framework: AGENT_FRAMEWORK_ENUM.optional(),
  provider: z.string().max(50).optional(),
  model: z.string().max(100).optional(),
  version: z.string().max(50).optional(),
  config: z.record(z.unknown()).optional(),
});

const updateAgentBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  framework: AGENT_FRAMEWORK_ENUM.optional(),
  provider: z.string().max(50).optional(),
  model: z.string().max(100).optional(),
  version: z.string().max(50).optional(),
  config: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface AgentResponse {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly framework: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly version: string | null;
  readonly config: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

function toAgentResponse(row: Record<string, unknown>): AgentResponse {
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
    name: row["name"] as string,
    description: (row["description"] as string) ?? null,
    framework: (row["framework"] as string) ?? null,
    provider: (row["provider"] as string) ?? null,
    model: (row["model"] as string) ?? null,
    version: (row["version"] as string) ?? null,
    config,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /v1/agents — Register an agent
 */
agents.post(
  "/",
  validate({ body: createAgentBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    // Verify the project exists and belongs to the organization
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
      `INSERT INTO agents (id, project_id, name, description, framework, provider, model, version, config, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
      .bind(
        id,
        body.project_id,
        body.name,
        body.description ?? null,
        body.framework ?? null,
        body.provider ?? null,
        body.model ?? null,
        body.version ?? null,
        JSON.stringify(body.config ?? {}),
        now,
        now
      )
      .run();

    const response: AgentResponse = {
      id,
      project_id: body.project_id,
      name: body.name,
      description: body.description ?? null,
      framework: body.framework ?? null,
      provider: body.provider ?? null,
      model: body.model ?? null,
      version: body.version ?? null,
      config: body.config ?? {},
      created_at: now,
      updated_at: now,
    };

    return c.json(response, 201);
  }
);

/**
 * GET /v1/agents/:id — Get agent by ID
 */
agents.get(
  "/:id",
  validate({ param: agentParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT a.* FROM agents a
       JOIN projects p ON p.id = a.project_id
       WHERE a.id = ?1 AND p.organization_id = ?2 AND a.deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Agent with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toAgentResponse(row), 200);
  }
);

/**
 * PATCH /v1/agents/:id — Update agent
 */
agents.patch(
  "/:id",
  validate({ param: agentParamsSchema, body: updateAgentBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT a.id FROM agents a
       JOIN projects p ON p.id = a.project_id
       WHERE a.id = ?1 AND p.organization_id = ?2 AND a.deleted_at IS NULL`
    )
      .bind(id, auth.organizationId)
      .first<{ id: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Agent with id '${id}' not found`,
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

    if (body.framework !== undefined) {
      setClauses.push(`framework = ?${paramIndex}`);
      params.push(body.framework);
      paramIndex++;
    }

    if (body.provider !== undefined) {
      setClauses.push(`provider = ?${paramIndex}`);
      params.push(body.provider);
      paramIndex++;
    }

    if (body.model !== undefined) {
      setClauses.push(`model = ?${paramIndex}`);
      params.push(body.model);
      paramIndex++;
    }

    if (body.version !== undefined) {
      setClauses.push(`version = ?${paramIndex}`);
      params.push(body.version);
      paramIndex++;
    }

    if (body.config !== undefined) {
      setClauses.push(`config = ?${paramIndex}`);
      params.push(JSON.stringify(body.config));
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
      `UPDATE agents SET ${setClauses.join(", ")} WHERE id = ?${paramIndex}`
    )
      .bind(...params, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM agents WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated agent",
          },
        },
        500
      );
    }

    return c.json(toAgentResponse(row), 200);
  }
);

export { agents as agentRoutes };
