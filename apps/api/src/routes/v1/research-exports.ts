import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const researchExports = new Hono<{ Bindings: Env }>();

const researchExportParamsSchema = z.object({
  id: z.string().min(1),
});

const createResearchExportBodySchema = z.object({
  dataset_id: z.string().optional(),
  benchmark_id: z.string().optional(),
  format: z.enum(["jsonl", "parquet", "csv", "arrow", "rest"]),
});

interface ResearchExportResponse {
  readonly id: string;
  readonly organization_id: string;
  readonly dataset_id: string | null;
  readonly benchmark_id: string | null;
  readonly format: string;
  readonly status: string;
  readonly file_path: string | null;
  readonly created_at: string;
}

function toResearchExportResponse(row: Record<string, unknown>): ResearchExportResponse {
  return {
    id: row["id"] as string,
    organization_id: row["organization_id"] as string,
    dataset_id: (row["dataset_id"] as string) ?? null,
    benchmark_id: (row["benchmark_id"] as string) ?? null,
    format: row["format"] as string,
    status: row["status"] as string,
    file_path: (row["file_path"] as string) ?? null,
    created_at: row["created_at"] as string,
  };
}

researchExports.post(
  "/",
  validate({ body: createResearchExportBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    if (!body.dataset_id && !body.benchmark_id) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Either dataset_id or benchmark_id is required",
          },
        },
        400
      );
    }

    if (body.dataset_id) {
      const dataset = await c.env.DB.prepare(
        `SELECT id FROM datasets WHERE id = ?1 AND organization_id = ?2`
      )
        .bind(body.dataset_id, auth.organizationId)
        .first<{ id: string }>();

      if (!dataset) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: `Dataset with id '${body.dataset_id}' not found`,
            },
          },
          404
        );
      }
    }

    if (body.benchmark_id) {
      const benchmark = await c.env.DB.prepare(
        `SELECT id FROM benchmarks WHERE id = ?1 AND organization_id = ?2`
      )
        .bind(body.benchmark_id, auth.organizationId)
        .first<{ id: string }>();

      if (!benchmark) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: `Benchmark with id '${body.benchmark_id}' not found`,
            },
          },
          404
        );
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO research_exports (id, organization_id, dataset_id, benchmark_id, format, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
      .bind(
        id,
        auth.organizationId,
        body.dataset_id ?? null,
        body.benchmark_id ?? null,
        body.format,
        "pending",
        now
      )
      .run();

    const response: ResearchExportResponse = {
      id,
      organization_id: auth.organizationId!,
      dataset_id: body.dataset_id ?? null,
      benchmark_id: body.benchmark_id ?? null,
      format: body.format,
      status: "pending",
      file_path: null,
      created_at: now,
    };

    return c.json(response, 201);
  }
);

researchExports.get("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM research_exports WHERE organization_id = ?1 AND created_at < ?2 ORDER BY created_at DESC LIMIT ?3`
    : `SELECT * FROM research_exports WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2`;
  const params = cursor
    ? [auth.organizationId, cursor, limit + 1]
    : [auth.organizationId, limit + 1];

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const items = (rows.results ?? []).map(toResearchExportResponse);
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

researchExports.get(
  "/:id",
  validate({ param: researchExportParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM research_exports WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Research export with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toResearchExportResponse(row), 200);
  }
);

export { researchExports as researchExportRoutes };
