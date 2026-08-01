import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../../test/fakeD1.js";
import { sha256Hex } from "../../lib/accessGrants.js";
import { ingestRoutes } from "./ingest.js";
import type { Env } from "../../workers/env.js";

const KEY_1 = "sk_ingest_key_one";
const KEY_2 = "sk_ingest_key_two";

let db: FakeD1;
let app: Hono<{ Bindings: Env }>;

beforeEach(async () => {
  db = new FakeD1({
    api_keys: [
      {
        id: "key-1",
        project_id: "proj-1",
        name: "ingest-a",
        key_hash: await sha256Hex(KEY_1),
        key_prefix: "sk_",
        permissions: "[]",
        created_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "key-2",
        project_id: "proj-2",
        name: "ingest-b",
        key_hash: await sha256Hex(KEY_2),
        key_prefix: "sk_",
        permissions: "[]",
        created_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
    ],
    projects: [
      { id: "proj-1", organization_id: "org-1" },
      { id: "proj-2", organization_id: "org-2" },
    ],
    executions: [
      {
        id: "exec-1",
        organization_id: "org-1",
        project_id: "proj-1",
        agent_id: "agent-1",
        status: "running",
        model: "llama-3.3-70b",
        provider: "groq",
        trace_id: null,
        parent_execution_id: null,
        pipeline_version: "1.0.0",
        sdk_version: "0.1.0",
        started_at: null,
        completed_at: null,
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        estimated_cost: null,
        metadata: "{}",
        error: null,
        created_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "exec-2",
        organization_id: "org-2",
        project_id: "proj-2",
        agent_id: "agent-2",
        status: "running",
        model: "llama-3.3-70b",
        provider: "groq",
        trace_id: null,
        parent_execution_id: null,
        pipeline_version: "1.0.0",
        sdk_version: "0.1.0",
        started_at: null,
        completed_at: null,
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        estimated_cost: null,
        metadata: "{}",
        error: null,
        created_at: "2026-07-01T00:00:00.000Z",
      },
    ],
  });

  db.on("JOIN projects", async (params) => {
    const keys = db.tables["api_keys"] ?? [];
    const key = keys.find((k) => k["id"] === params[0] && k["deleted_at"] === null);
    if (!key) {
      return undefined;
    }
    const projects = db.tables["projects"] ?? [];
    const project = projects.find((p) => p["id"] === key["project_id"]);
    return {
      key_id: key["id"],
      project_id: key["project_id"],
      organization_id: project ? project["organization_id"] : null,
    };
  });

  app = new Hono<{ Bindings: Env }>();
  app.route("/v1/ingest", ingestRoutes);
});

function patch(path: string, body: unknown, key?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) {
    headers["Authorization"] = `Bearer ${key}`;
  }
  return app.request(
    `/v1/ingest${path}`,
    { method: "PATCH", headers, body: JSON.stringify(body) },
    { DB: db, ENVIRONMENT: "test" }
  );
}

describe("PATCH /v1/ingest/executions/:id", () => {
  it("rejects without an API key", async () => {
    const res = await patch("/executions/exec-1", { status: "completed" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 for an unknown execution", async () => {
    const res = await patch("/executions/does-not-exist", { status: "completed" }, KEY_1);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Execution not found");
  });

  it("returns 403 when the key is scoped to a different project", async () => {
    const res = await patch("/executions/exec-2", { status: "completed" }, KEY_1);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("updates the execution and persists metrics", async () => {
    const res = await patch(
      "/executions/exec-1",
      {
        status: "completed",
        latency_ms: 1234,
        cost_usd: 0.0042,
        tokens_in: 1500,
        tokens_out: 750,
        error: "no error",
      },
      KEY_1
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { id: string; status: string } };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "exec-1", status: "completed" });

    const rows = db.tables["executions"] ?? [];
    const row = rows.find((e) => e["id"] === "exec-1");
    expect(row?.["status"]).toBe("completed");
    expect(row?.["completed_at"]).toBeTypeOf("string");
    expect(row?.["latency_ms"]).toBe(1234);
    expect(row?.["input_tokens"]).toBe(1500);
    expect(row?.["output_tokens"]).toBe(750);
    expect(row?.["total_tokens"]).toBe(2250);
    expect(row?.["estimated_cost"]).toBe(0.0042);
    expect(row?.["error"]).toBe("no error");
  });

  it("computes total_tokens from tokens_in + tokens_out", async () => {
    const res = await patch(
      "/executions/exec-1",
      { status: "failed", tokens_in: 300, tokens_out: 200, error: "boom" },
      KEY_1
    );
    expect(res.status).toBe(200);
    const rows = db.tables["executions"] ?? [];
    const row = rows.find((e) => e["id"] === "exec-1");
    expect(row?.["status"]).toBe("failed");
    expect(row?.["input_tokens"]).toBe(300);
    expect(row?.["output_tokens"]).toBe(200);
    expect(row?.["total_tokens"]).toBe(500);
  });

  it("honors an explicit completed_at instead of defaulting", async () => {
    const res = await patch(
      "/executions/exec-1",
      { status: "failed", completed_at: "2026-07-05T10:00:00.000Z" },
      KEY_1
    );
    expect(res.status).toBe(200);
    const rows = db.tables["executions"] ?? [];
    const row = rows.find((e) => e["id"] === "exec-1");
    expect(row?.["completed_at"]).toBe("2026-07-05T10:00:00.000Z");
  });

  it("rejects an invalid status", async () => {
    const res = await patch("/executions/exec-1", { status: "created" }, KEY_1);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
