import { describe, it, expect } from "vitest";
import { FakeD1, type Row } from "../test/fakeD1.js";
import {
  recordAccessAudit,
  listAccessAudit,
  summarizeAccessAudit,
} from "./accessAudit.js";

const db = new FakeD1({
  access_audit: [
    {
      id: "a1",
      grant_id: "grant-1",
      organization_id: "org-1",
      agent_id: "agent-1",
      method: "GET",
      path: "/v1/access/executions",
      rows_returned: 10,
      ip: "1.2.3.4",
      user_agent: "test",
      created_at: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "a2",
      grant_id: "grant-1",
      organization_id: "org-1",
      agent_id: "agent-2",
      method: "GET",
      path: "/v1/access/executions",
      rows_returned: 5,
      ip: "1.2.3.4",
      user_agent: "test",
      created_at: "2026-07-02T00:00:00.000Z",
    },
    {
      id: "a3",
      grant_id: "grant-2",
      organization_id: "org-1",
      agent_id: "agent-1",
      method: "GET",
      path: "/v1/access/executions/:id",
      rows_returned: 2,
      ip: "5.6.7.8",
      user_agent: "test",
      created_at: "2026-07-03T00:00:00.000Z",
    },
    {
      id: "a4",
      grant_id: "grant-9",
      organization_id: "org-other",
      agent_id: "agent-x",
      method: "GET",
      path: "/v1/access/executions",
      rows_returned: 99,
      ip: "9.9.9.9",
      user_agent: "test",
      created_at: "2026-07-04T00:00:00.000Z",
    },
  ],
  access_grants: [
    { id: "grant-1", organization_id: "org-1", name: "Magma" },
    { id: "grant-2", organization_id: "org-1", name: "Other Co" },
  ],
});

describe("accessAudit", () => {
  db.on("SELECT DISTINCT agent_id", async (params) => {
    const grantId = params[0];
    return db.tables["access_audit"]
      .filter((row) => row["grant_id"] === grantId && row["agent_id"] !== null)
      .map((row) => ({ agent_id: row["agent_id"] }));
  });

  db.on("GROUP BY a.grant_id", async (params) => {
    const orgId = params[0];
    const rows = db.tables["access_audit"].filter((row) => row["organization_id"] === orgId);
    const byGrant = new Map<string, Row[]>();
    for (const row of rows) {
      const grantId = String(row["grant_id"]);
      const bucket = byGrant.get(grantId) ?? [];
      bucket.push(row);
      byGrant.set(grantId, bucket);
    }
    return Array.from(byGrant.entries()).map(([grantId, auditRows]) => {
      const grant = db.tables["access_grants"].find((g) => g["id"] === grantId);
      const times = auditRows.map((r) => String(r["created_at"] ?? "")).sort();
      return {
        grant_id: grantId,
        grant_name: grant ? String(grant["name"]) : "unknown",
        requests: auditRows.length,
        rows_returned: auditRows.reduce((sum, r) => sum + Number(r["rows_returned"] ?? 0), 0),
        first_used_at: times[0] ?? null,
        last_used_at: times[times.length - 1] ?? null,
      };
    });
  });

  it("records an audit entry", async () => {
    const db2 = new FakeD1({ access_audit: [], access_grants: [] });
    await recordAccessAudit(db2, {
      grantId: "grant-1",
      organizationId: "org-1",
      agentId: "agent-1",
      method: "GET",
      path: "/v1/access/executions",
      rowsReturned: 3,
      ip: "1.2.3.4",
      userAgent: "curl",
    });
    expect(db2.tables["access_audit"].length).toBe(1);
    expect(db2.tables["access_audit"][0]["rows_returned"]).toBe(3);
    expect(db2.tables["access_audit"][0]["user_agent"]).toBe("curl");
  });

  it("lists audit rows scoped to the organization", async () => {
    const { rows } = await listAccessAudit(db, { organizationId: "org-1", limit: 10 });
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.organizationId === "org-1")).toBe(true);
  });

  it("filters by grant and agent", async () => {
    const byGrant = await listAccessAudit(db, {
      organizationId: "org-1",
      grantId: "grant-2",
      limit: 10,
    });
    expect(byGrant.rows).toHaveLength(1);
    expect(byGrant.rows[0].id).toBe("a3");

    const byAgent = await listAccessAudit(db, {
      organizationId: "org-1",
      agentId: "agent-2",
      limit: 10,
    });
    expect(byAgent.rows).toHaveLength(1);
    expect(byAgent.rows[0].id).toBe("a2");
  });

  it("supports cursor pagination", async () => {
    const page1 = await listAccessAudit(db, { organizationId: "org-1", limit: 2 });
    expect(page1.rows).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listAccessAudit(db, {
      organizationId: "org-1",
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.rows).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    expect(page2.rows[0].id).not.toBe(page1.rows[0].id);
    expect(page2.rows[0].id).not.toBe(page1.rows[1].id);
  });

  it("summarizes usage per grant with distinct agents", async () => {
    const summaries = await summarizeAccessAudit(db, { organizationId: "org-1" });
    expect(summaries).toHaveLength(2);

    const magma = summaries.find((s) => s.grant_id === "grant-1");
    expect(magma?.requests).toBe(2);
    expect(magma?.rows_returned).toBe(15);
    expect(magma?.agents_read).toEqual(expect.arrayContaining(["agent-1", "agent-2"]));
    expect(magma?.last_used_at).toBe("2026-07-02T00:00:00.000Z");

    const other = summaries.find((s) => s.grant_id === "grant-2");
    expect(other?.requests).toBe(1);
    expect(other?.rows_returned).toBe(2);
  });
});
