import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../../test/fakeD1.js";
import { sha256Hex } from "../../lib/accessGrants.js";
import { accessGrantRoutes } from "./access-grants.js";
import type { Env } from "../../workers/env.js";

const OWNER_KEY = "owner-secret-key-123";
let db: FakeD1;
let app: Hono<{ Bindings: Env }>;

beforeEach(async () => {
  db = new FakeD1({
    api_keys: [
      {
        id: "key-1",
        project_id: "proj-1",
        name: "owner",
        key_hash: await sha256Hex(OWNER_KEY),
        key_prefix: "sk_test",
        permissions: "[]",
        created_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
    ],
    projects: [{ id: "proj-1", organization_id: "org-1" }],
    agents: [
      { id: "agent-1", project_id: "proj-1", name: "SEEA" },
      { id: "agent-2", project_id: "proj-1", name: "Demo" },
    ],
    access_grants: [],
    access_audit: [],
  });

  db.on("JOIN projects", async (params) => {
    const key = db.tables["api_keys"].find((k) => k["id"] === params[0] && k["deleted_at"] === null);
    if (!key) {
      return undefined;
    }
    return {
      key_id: key["id"],
      project_id: key["project_id"],
      organization_id: "org-1",
    };
  });

  db.on("COUNT(*) AS count FROM agents", async (params) => {
    return { count: params.filter((id) => db.tables["agents"].some((a) => a["id"] === id)).length };
  });

  app = new Hono<{ Bindings: Env }>();
  app.route("/v1/access", accessGrantRoutes);
});

function ownerHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${OWNER_KEY}`, "Content-Type": "application/json" };
}

describe("access-grants routes", () => {
  it("rejects without an owner API key", async () => {
    const res = await app.request("/v1/access/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Magma", agent_ids: ["agent-1"] }),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(401);
  });

  it("issues a grant and returns the one-time credential", async () => {
    const res = await app.request("/v1/access/grants", {
      method: "POST",
      headers: ownerHeaders(),
      body: JSON.stringify({ name: "Magma", agent_ids: ["agent-1"] }),
    }, { DB: db, ENVIRONMENT: "test" });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { grant: { id: string; name: string; status: string }; credential: string; warning: string };
    };
    expect(body.data.grant.name).toBe("Magma");
    expect(body.data.grant.status).toBe("active");
    expect(body.data.credential.startsWith("mag_")).toBe(true);
    expect(body.data.warning).toContain("once");
    expect(db.tables["access_grants"]).toHaveLength(1);
  });

  it("rejects grant issuance for nonexistent agents", async () => {
    const res = await app.request("/v1/access/grants", {
      method: "POST",
      headers: ownerHeaders(),
      body: JSON.stringify({ name: "Magma", agent_ids: ["ghost-agent"] }),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_AGENT");
  });

  it("lists grants with usage counters", async () => {
    db.tables["access_grants"].push({
      id: "grant-1",
      organization_id: "org-1",
      name: "Magma",
      agent_ids: JSON.stringify(["agent-1"]),
      credential_hash: "hash",
      key_prefix: "mag_01234567",
      status: "active",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    db.tables["access_audit"].push({
      id: "audit-1",
      grant_id: "grant-1",
      organization_id: "org-1",
      rows_returned: 42,
      created_at: "2026-07-02T00:00:00.000Z",
    });

    db.on("GROUP BY grant_id", async () => {
      return [{ grant_id: "grant-1", requests: 1, rows_returned: 42 }];
    });

    const res = await app.request("/v1/access/grants", {
      headers: ownerHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; name: string; requests: number; rows_returned: number }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Magma");
    expect(body.data[0].requests).toBe(1);
    expect(body.data[0].rows_returned).toBe(42);
  });

  it("revokes a grant", async () => {
    db.tables["access_grants"].push({
      id: "grant-1",
      organization_id: "org-1",
      name: "Magma",
      agent_ids: JSON.stringify(["agent-1"]),
      credential_hash: "hash",
      key_prefix: "mag_01234567",
      status: "active",
      created_at: "2026-07-01T00:00:00.000Z",
    });

    const res = await app.request("/v1/access/grants/grant-1", {
      method: "DELETE",
      headers: ownerHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; status: string } };
    expect(body.data.status).toBe("revoked");
    expect(db.tables["access_grants"][0]["status"]).toBe("revoked");
  });

  it("returns 404 when revoking a grant of another organization", async () => {
    db.tables["access_grants"].push({
      id: "grant-other",
      organization_id: "org-other",
      name: "Intruder",
      agent_ids: JSON.stringify([]),
      credential_hash: "hash",
      key_prefix: "mag_01234567",
      status: "active",
      created_at: "2026-07-01T00:00:00.000Z",
    });

    const res = await app.request("/v1/access/grants/grant-other", {
      method: "DELETE",
      headers: ownerHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(404);
  });
});
