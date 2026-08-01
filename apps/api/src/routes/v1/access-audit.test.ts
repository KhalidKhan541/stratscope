import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../../test/fakeD1.js";
import { sha256Hex } from "../../lib/accessGrants.js";
import { accessAuditRoutes } from "./access-audit.js";
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
    access_grants: [
      { id: "grant-1", organization_id: "org-1", name: "Magma" },
      { id: "grant-other", organization_id: "org-other", name: "Other" },
    ],
    access_audit: [
      {
        id: "audit-1",
        grant_id: "grant-1",
        organization_id: "org-1",
        agent_id: "agent-1",
        method: "GET",
        path: "/v1/access/executions",
        rows_returned: 10,
        ip: "1.2.3.4",
        user_agent: "magma-client",
        created_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "audit-2",
        grant_id: "grant-1",
        organization_id: "org-1",
        agent_id: "agent-1",
        method: "GET",
        path: "/v1/access/executions",
        rows_returned: 5,
        ip: "1.2.3.4",
        user_agent: "magma-client",
        created_at: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "audit-3",
        grant_id: "grant-other",
        organization_id: "org-other",
        agent_id: "agent-9",
        method: "GET",
        path: "/v1/access/executions",
        rows_returned: 999,
        ip: "9.9.9.9",
        user_agent: "intruder",
        created_at: "2026-07-03T00:00:00.000Z",
      },
    ],
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

  db.on("GROUP BY a.grant_id", async () => {
    return [
      { grant_id: "grant-1", grant_name: "Magma", requests: 2, rows_returned: 15, first_used_at: "2026-07-01T00:00:00.000Z", last_used_at: "2026-07-02T00:00:00.000Z" },
    ];
  });

  db.on("SELECT DISTINCT agent_id FROM access_audit", async () => {
    return [{ agent_id: "agent-1" }];
  });

  app = new Hono<{ Bindings: Env }>();
  app.route("/v1/access", accessAuditRoutes);
});

function ownerHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${OWNER_KEY}` };
}

describe("access-audit routes", () => {
  it("rejects without an owner API key", async () => {
    const res = await app.request("/v1/access/audit", {}, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(401);
  });

  it("lists audit rows for the owner organization only", async () => {
    const res = await app.request("/v1/access/audit", { headers: ownerHeaders() }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; grantId: string; rowsReturned: number }>;
      pagination: { cursor: string | null; has_more: boolean };
    };
    expect(body.data).toHaveLength(2);
    expect(body.data.every((row) => row.grantId === "grant-1")).toBe(true);
  });

  it("returns 404 when filtering by another org's grant", async () => {
    const res = await app.request("/v1/access/audit?grant_id=grant-other", {
      headers: ownerHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(404);
  });

  it("returns an invoice-ready summary with estimated fees", async () => {
    const res = await app.request("/v1/access/audit/summary", {
      headers: ownerHeaders(),
    }, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{
        grant_id: string;
        grant_name: string;
        requests: number;
        rows_returned: number;
        agents_read: string[];
        estimated_fee_usd: number;
      }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].grant_name).toBe("Magma");
    expect(body.data[0].requests).toBe(2);
    expect(body.data[0].rows_returned).toBe(15);
    expect(body.data[0].agents_read).toEqual(["agent-1"]);
    expect(body.data[0].estimated_fee_usd).toBe(0.02);
  });
});
