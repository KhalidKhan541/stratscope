/**
 * Project routes — management.
 *
 * Handles project CRUD operations within an organization.
 * All routes are versioned under /v1/projects.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const projects = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const projectParamsSchema = z.object({
  id: z.string().min(1),
});

const createProjectBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1, "Slug is required").max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  environment: z.enum(["development", "staging", "production"]).default("development"),
  settings: z.record(z.unknown()).optional(),
});

const updateProjectBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  environment: z.enum(["development", "staging", "production"]).optional(),
  settings: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface ProjectResponse {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly slug: string;
  readonly environment: string;
  readonly settings: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

function toProjectResponse(row: Record<string, unknown>): ProjectResponse {
  let settings: Record<string, unknown> = {};
  if (typeof row["settings"] === "string") {
    try {
      settings = JSON.parse(row["settings"]) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  }

  return {
    id: row["id"] as string,
    organization_id: row["organization_id"] as string,
    name: row["name"] as string,
    slug: row["slug"] as string,
    environment: row["environment"] as string,
    settings,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /v1/projects — Create a project
 */
projects.post(
  "/",
  validate({ body: createProjectBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    // Check for slug uniqueness within the organization
    const existing = await c.env.DB.prepare(
      `SELECT id FROM projects WHERE organization_id = ?1 AND slug = ?2 AND deleted_at IS NULL`
    )
      .bind(auth.orgId, body.slug)
      .first<{ id: string }>();

    if (existing) {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `Project with slug '${body.slug}' already exists in this organization`,
          },
        },
        409
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO projects (id, organization_id, name, slug, environment, settings, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        id,
        auth.orgId,
        body.name,
        body.slug,
        body.environment,
        JSON.stringify(body.settings ?? {}),
        now,
        now
      )
      .run();

    const response: ProjectResponse = {
      id,
      organization_id: auth.orgId,
      name: body.name,
      slug: body.slug,
      environment: body.environment,
      settings: body.settings ?? {},
      created_at: now,
      updated_at: now,
    };

    return c.json(response, 201);
  }
);

/**
 * GET /v1/projects/:id — Get project by ID
 */
projects.get(
  "/:id",
  validate({ param: projectParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(id, auth.orgId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Project with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toProjectResponse(row), 200);
  }
);

/**
 * PATCH /v1/projects/:id — Update project
 */
projects.patch(
  "/:id",
  validate({ param: projectParamsSchema, body: updateProjectBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id FROM projects WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
    )
      .bind(id, auth.orgId)
      .first<{ id: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Project with id '${id}' not found`,
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

    if (body.environment !== undefined) {
      setClauses.push(`environment = ?${paramIndex}`);
      params.push(body.environment);
      paramIndex++;
    }

    if (body.settings !== undefined) {
      setClauses.push(`settings = ?${paramIndex}`);
      params.push(JSON.stringify(body.settings));
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
      `UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?${paramIndex} AND organization_id = ?${paramIndex + 1} AND deleted_at IS NULL`
    )
      .bind(...params, id, auth.orgId)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.orgId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated project",
          },
        },
        500
      );
    }

    return c.json(toProjectResponse(row), 200);
  }
);

export { projects as projectRoutes };
