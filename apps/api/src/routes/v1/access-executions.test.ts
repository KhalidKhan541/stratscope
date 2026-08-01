import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../../test/fakeD1.js";
import { sha256Hex } from "../../lib/accessGrants.js";
import { accessExecutionRoutes } from "./access-executions.js";
import type { Env } from "../../workers/env.js";

const CREDENTIAL = "mag_abcd1234abcd1234abcd1234abcd1234";
let db: FakeD1;
let app: Hono<{ Bindings: Env }>;

beforeEach(async () => {
  db = new FakeD1({
    access_grants: [
      {
        id: "grant-1",
        organization_id: "org-1",
        name: "Magma",
        agent_ids: JSON.stringify(["agent-1"]),
        credential_hash: await sha256Hex(CREDENTIAL),
        key_prefix: "mag_abcd1234",
        status: "active",
        created_by: null,
        created_at: "2026-07-01T00:00:00.000Z",
        revoked_at: null,
        revoked_by: null,
      },
    ],
    executions: [
      {
        id: "exec-1",
        organization_id: "org-1",
        project_id: "proj-1",
        agent_id: "agent-1",
        status: "completed",
        model: "llama-3.3-70b",
        provider: "groq",
        metadata: JSON.stringify({ "user.email": "john@example.com", trace: "t-1" }),
        error: null,
        created_at: "2026-07-02T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "exec-2",
        organization_id: "org-1",
        project_id: "proj-1",
        agent_id: "agent-1",
        status: "failed",
        model: "llama-3.3-70b",
        provider: "groq",
        metadata: JSON.stringify({ trace: "t-2" }),
        error: "Rate limit 429 for apikey gsk_abcd12345678",
        created_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "exec-3",
        organization_id: "org-1",
        project_id: "proj-1",
        agent_id: "agent-2",
        status: "completed",
        model: "llama-3.3-70b",
        provider: "groq",
        metadata: JSON.stringify({ trace: "t-3" }),
        error: null,
        created_at: "2026-06-30T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "exec-4",
        organization_id: "org-other",
        project_id: "proj-2",
        agent_id: "agent-1",
        status: "completed",
        model: "llama-3.3-70b",
        provider: "groq",
        metadata: JSON.stringify({ trace: "t-4" }),
        error: null,
        created_at: "2026-06-29T00:00:00.000Z",
        deleted_at: null,
      },
    ],
    events: [
      {
        id: "evt-1",
        execution_id: "exec-1",
        event_type: "tool.executed",
        service: "seea",
        payload: JSON.stringify({ "user.email": "john@example.com", input: "hello" }),
        metadata: "{}",
        timestamp: "2026-07-02T00:00:01.000Z",
        schema_version: "1.0",
      },
    ],
    evaluations: [
      {
        id: "eval-1",
        execution_id: "exec-1",
        accuracy: 0.9,
        goal_completion: 1,
        hallucination_score: 0.1,
        confidence: 0.8,
        cost_efficiency: 0.7,
        latency_score: 0.6,
        safety_score: 1,
        evaluation_model: "llama-3.3-70b",
        summary: "Solid run for john@example.com",
        details: JSON.stringify({ notes: "good" }),
        created_at: "2026-07-02T00:00:02.000Z",
      },
    ],
    reflections: [
      {
        id: "refl-1",
        execution_id: "exec-1",
        summary: "Consider retrying on failure",
        strengths: JSON.stringify(["clear steps"]),
        weaknesses: JSON.stringify(["slow"]),
        recommendations: JSON.stringify(["retry with backoff"]),
        confidence: 0.7,
        reflection_model: "llama-3.3-70b",
        reasoning: "Error showed gsk_abcd12345678",
        created_at: "2026-07-02T00:00:03.000Z",
      },
    ],
    consent_policies: [
      {
        id: "cp-1",
        agent_id: "agent-1",
        organization_id: "org-1",
        requires_anonymization: 1,
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
    access_audit: [],
  });

  app = new Hono<{ Bindings: Env }>();
  app.route("/v1/access/executions", accessExecutionRoutes);
});

function magmaHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${CREDENTIAL}` };
}

describe("access-executions routes", () => {
  it("rejects without a credential", async () => {
    const res = await app.request("/v1/access/executions", {}, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(401);
  });

  it("rejects an agent not covered by the grant", async () => {
    const res = await app.request("/v1/access/executions?agent_id=agent-2", {
      headers: magmaHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns only granted agents of the organization with redaction", async () => {
    const res = await app.request("/v1/access/executions?agent_id=agent-1", {
      headers: magmaHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; metadata: Record<string, unknown>; error: string | null }>;
      pagination: { cursor: string | null; has_more: boolean; limit: number };
    };
    expect(body.data).toHaveLength(2);
    expect(body.data.every((e) => e.id !== "exec-3" && e.id !== "exec-4")).toBe(true);

    const exec1 = body.data.find((e) => e.id === "exec-1");
    expect(exec1?.metadata["user.email"]).toBe("[redacted:email]");
    expect(exec1?.metadata["trace"]).toBe("t-1");

    const exec2 = body.data.find((e) => e.id === "exec-2");
    expect(exec2?.error).toContain("[redacted:api_key]");
  });

  it("returns raw metadata when consent allows", async () => {
    db.tables["consent_policies"][0]["requires_anonymization"] = 0;
    const res = await app.request("/v1/access/executions?agent_id=agent-1", {
      headers: magmaHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    const body = (await res.json()) as { data: Array<{ metadata: Record<string, unknown> }> };
    expect(body.data.find((e) => e.metadata["user.email"])?.metadata["user.email"]).toBe("john@example.com");
  });

  it("paginates with cursor and records audit", async () => {
    const page1 = await app.request("/v1/access/executions?agent_id=agent-1&limit=1", {
      headers: magmaHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    const body1 = (await page1.json()) as {
      data: Array<{ id: string; created_at: string }>;
      pagination: { cursor: string | null; has_more: boolean };
    };
    expect(body1.data).toHaveLength(1);
    expect(body1.data[0].id).toBe("exec-1");
    expect(body1.pagination.has_more).toBe(true);
    expect(body1.pagination.cursor).not.toBeNull();

    const page2 = await app.request(
      `/v1/access/executions?agent_id=agent-1&limit=1&cursor=${encodeURIComponent(body1.pagination.cursor ?? "")}`,
      { headers: magmaHeaders() },
      { DB: db, ENVIRONMENT: "test" }
    );
    const body2 = (await page2.json()) as { data: Array<{ id: string }>; pagination: { has_more: boolean } };
    expect(body2.data).toHaveLength(1);
    expect(body2.data[0].id).toBe("exec-2");
    expect(body2.pagination.has_more).toBe(false);

    expect(db.tables["access_audit"]).toHaveLength(2);
    const firstAudit = db.tables["access_audit"][0];
    expect(firstAudit["grant_id"]).toBe("grant-1");
    expect(firstAudit["rows_returned"]).toBe(1);
  });

  it("returns execution detail with redacted events and evaluations", async () => {
    const res = await app.request("/v1/access/executions/exec-1", {
      headers: magmaHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        execution: { id: string };
        events: Array<{ payload: Record<string, unknown> }>;
        evaluations: Array<{ summary: string | null }>;
        reflections: Array<{ reasoning: string | null }>;
      };
    };
    expect(body.data.execution.id).toBe("exec-1");
    expect(body.data.events).toHaveLength(1);
    expect(body.data.events[0].payload["user.email"]).toBe("[redacted:email]");
    expect(body.data.evaluations[0].summary).toContain("[redacted:email]");
    expect(body.data.reflections[0].reasoning).toContain("[redacted:api_key]");

    expect(db.tables["access_audit"]).toHaveLength(1);
    expect(db.tables["access_audit"][0]["path"]).toBe("/v1/access/executions/:id");
    expect(db.tables["access_audit"][0]["rows_returned"]).toBe(2);
  });

  it("returns 404 for out-of-scope execution details", async () => {
    const res = await app.request("/v1/access/executions/exec-4", {
      headers: magmaHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(404);
  });
});
