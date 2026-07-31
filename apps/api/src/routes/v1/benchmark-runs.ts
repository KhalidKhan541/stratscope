import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const benchmarkRuns = new Hono<{ Bindings: Env }>();

const benchmarkRunParamsSchema = z.object({
  id: z.string().min(1),
});

const createBenchmarkRunBodySchema = z.object({
  benchmark_id: z.string().min(1, "benchmark_id is required"),
  project_id: z.string().min(1, "project_id is required"),
  dataset_version_id: z.string().min(1, "dataset_version_id is required"),
});

interface BenchmarkRunResponse {
  readonly id: string;
  readonly benchmark_id: string;
  readonly project_id: string;
  readonly organization_id: string;
  readonly dataset_version_id: string;
  readonly status: string;
  readonly results: Record<string, unknown> | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
}

function toBenchmarkRunResponse(row: Record<string, unknown>): BenchmarkRunResponse {
  let results: Record<string, unknown> | null = null;
  if (typeof row["results"] === "string") {
    try {
      results = JSON.parse(row["results"]) as Record<string, unknown>;
    } catch {
      results = null;
    }
  }

  return {
    id: row["id"] as string,
    benchmark_id: row["benchmark_id"] as string,
    project_id: row["project_id"] as string,
    organization_id: row["organization_id"] as string,
    dataset_version_id: row["dataset_version_id"] as string,
    status: row["status"] as string,
    results,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
    started_at: (row["started_at"] as string) ?? null,
    completed_at: (row["completed_at"] as string) ?? null,
  };
}

benchmarkRuns.post(
  "/",
  validate({ body: createBenchmarkRunBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    const benchmark = await c.env.DB.prepare(
      `SELECT id FROM benchmarks WHERE id = ?1 AND organization_id = ?2 AND deleted_at IS NULL`
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

    const datasetVersion = await c.env.DB.prepare(
      `SELECT id FROM dataset_versions WHERE id = ?1`
    )
      .bind(body.dataset_version_id)
      .first<{ id: string }>();

    if (!datasetVersion) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Dataset version with id '${body.dataset_version_id}' not found`,
          },
        },
        404
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO benchmark_runs (id, benchmark_id, project_id, organization_id, dataset_version_id, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        id,
        body.benchmark_id,
        body.project_id,
        auth.organizationId,
        body.dataset_version_id,
        "pending",
        now,
        now
      )
      .run();

    const response: BenchmarkRunResponse = {
      id,
      benchmark_id: body.benchmark_id,
      project_id: body.project_id,
      organization_id: auth.organizationId!,
      dataset_version_id: body.dataset_version_id,
      status: "pending",
      results: null,
      created_at: now,
      updated_at: now,
      started_at: null,
      completed_at: null,
    };

    return c.json(response, 201);
  }
);

benchmarkRuns.get("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const cursor = c.req.query("cursor");

  const query = cursor
    ? `SELECT * FROM benchmark_runs WHERE organization_id = ?1 AND created_at < ?2 ORDER BY created_at DESC LIMIT ?3`
    : `SELECT * FROM benchmark_runs WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2`;
  const params = cursor
    ? [auth.organizationId, cursor, limit + 1]
    : [auth.organizationId, limit + 1];

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const items = (rows.results ?? []).map(toBenchmarkRunResponse);
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

benchmarkRuns.get(
  "/:id",
  validate({ param: benchmarkRunParamsSchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const { id } = c.req.valid("param") as any;

    const row = await c.env.DB.prepare(
      `SELECT * FROM benchmark_runs WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!row) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Benchmark run with id '${id}' not found`,
          },
        },
        404
      );
    }

    return c.json(toBenchmarkRunResponse(row), 200);
  }
);

export { benchmarkRuns as benchmarkRunRoutes };
