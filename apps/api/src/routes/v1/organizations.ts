/**
 * Organization routes — management.
 *
 * Handles organization CRUD operations.
 * All routes are versioned under /v1/organizations.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const organizations = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const organizationParamsSchema = z.object({
  id: z.string().min(1),
});

const createOrganizationBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1, "Slug is required").max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  plan: z.enum(["free", "pro", "enterprise"]).default("free"),
  settings: z.record(z.unknown()).optional(),
});

const updateOrganizationBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface OrganizationResponse {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly plan: string;
  readonly settings: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

function toOrganizationResponse(row: Record<string, unknown>): OrganizationResponse {
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
    name: row["name"] as string,
    slug: row["slug"] as string,
    plan: row["plan"] as string,
    settings,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /v1/organizations — Create an organization
 */
organizations.post(
  "/",
  validate({ body: createOrganizationBodySchema }),
  async (c) => {
    const body = c.req.valid("json") as any;

    // Check for slug uniqueness
    const existing = await c.env.DB.prepare(
      `SELECT id FROM organizations WHERE slug = ?1 AND deleted_at IS NULL`
    )
      .bind(body.slug)
      .first<{ id: string }>();

    if (existing) {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `Organization with slug '${body.slug}' already exists`,
          },
        },
        409
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO organizations (id, name, slug, plan, settings, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
      .bind(
        id,
        body.name,
        body.slug,
        body.plan,
        JSON.stringify(body.settings ?? {}),
        now,
        now
      )
      .run();

    const response: OrganizationResponse = {
      id,
      name: body.name,
      slug: body.slug,
      plan: body.plan,
      settings: body.settings ?? {},
      created_at: now,
      updated_at: now,
    };

    return c.json(response, 201);
  }
);

/**
 * GET /v1/organizations/:id — Get organization by ID
 */
organizations.get(
  "/:id",
  validate({ param: organizationParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM organizations WHERE id = ?1 AND deleted_at IS NULL`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Organization with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toOrganizationResponse(row), 200);
  }
);

/**
 * PATCH /v1/organizations/:id — Update organization
 */
organizations.patch(
  "/:id",
  validate({ param: organizationParamsSchema, body: updateOrganizationBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;
    const body = c.req.valid("json") as any;

    const existing = await c.env.DB.prepare(
      `SELECT id FROM organizations WHERE id = ?1 AND deleted_at IS NULL`
    )
      .bind(id)
      .first<{ id: string }>();

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Organization with id '${id}' not found`,
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
      `UPDATE organizations SET ${setClauses.join(", ")} WHERE id = ?${paramIndex} AND deleted_at IS NULL`
    )
      .bind(...params, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM organizations WHERE id = ?1`
    )
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated organization",
          },
        },
        500
      );
    }

    return c.json(toOrganizationResponse(row), 200);
  }
);

export { organizations as organizationRoutes };
