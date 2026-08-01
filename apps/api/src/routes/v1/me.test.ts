import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../../test/fakeD1.js";
import { createSession } from "../../lib/authSession.js";
import type { SessionUser } from "../../lib/authSession.js";
import { meRoutes } from "./me.js";
import type { Env } from "../../workers/env.js";

class FakeKV {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

const USER_ONE: SessionUser = {
  userId: "user-1",
  organizationId: "org-1",
  email: "dev@example.com",
  name: "Dev",
  role: "owner",
  provider: "password",
};

const USER_TWO: SessionUser = {
  userId: "user-2",
  organizationId: "org-2",
  email: "other@example.com",
  name: "Other",
  role: "owner",
  provider: "password",
};

let db: FakeD1;
let kv: FakeKV;
let app: Hono<{ Bindings: Env }>;

function ownerKeyRow(
  id: string,
  projectId: string,
  organizationId: string,
  prefix: string
): Record<string, unknown> {
  return {
    id,
    project_id: projectId,
    name: `owner-key:${organizationId}`,
    key_hash: `hash-of-${id}`,
    key_prefix: prefix,
    permissions: "[]",
    created_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
  };
}

beforeEach(() => {
  db = new FakeD1({
    organizations: [
      { id: "org-1", name: "Org One", slug: "org-one", deleted_at: null },
      { id: "org-2", name: "Org Two", slug: "org-two", deleted_at: null },
    ],
    users: [
      {
        id: "user-1",
        organization_id: "org-1",
        clerk_user_id: "local_user-1",
        email: "dev@example.com",
        name: "Dev",
        role: "owner",
        status: "active",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "user-2",
        organization_id: "org-2",
        clerk_user_id: "local_user-2",
        email: "other@example.com",
        name: "Other",
        role: "owner",
        status: "active",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
    ],
    sessions: [],
    oauth_accounts: [],
    projects: [
      { id: "proj-1", organization_id: "org-1", name: "Default", slug: "default", deleted_at: null },
      { id: "proj-2", organization_id: "org-2", name: "Other", slug: "other", deleted_at: null },
    ],
    api_keys: [],
    agents: [],
  });

  db.on("owner-key:", async (params) => {
    const orgId = String(params[0] ?? "");
    const name = `owner-key:${orgId}`;
    const row = (db.tables["api_keys"] ?? []).find(
      (k) =>
        k["name"] === name &&
        k["deleted_at"] === null &&
        (db.tables["projects"] ?? []).find((p) => p["id"] === k["project_id"])?.[
          "organization_id"
        ] === orgId
    );
    if (!row) {
      return undefined;
    }
    return { id: row["id"], key_prefix: row["key_prefix"], project_id: row["project_id"] };
  });

  kv = new FakeKV();
  app = new Hono<{ Bindings: Env }>();
  app.route("/v1/me", meRoutes);
});

async function tokenFor(user: SessionUser): Promise<string> {
  const session = await createSession(db, { user });
  return session.token;
}

function get(path: string, token: string | null, bindings: { DB: FakeD1; KV?: FakeKV }) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const env = { DB: bindings.DB, KV: bindings.KV, ENVIRONMENT: "test" };
  return app.request(`/v1/me${path}`, { headers }, env);
}

interface IntegrationData {
  api_key: string | null;
  key_prefix: string | null;
  key_retrievable: boolean;
  project_id: string | null;
  agent_id: string | null;
  agent_name: string | null;
  base_url: string;
  ingest_endpoint: string;
  sdk: { python: string; typescript: string };
}

describe("GET /v1/me/integration", () => {
  it("rejects requests without a session token", async () => {
    const res = await get("/integration", null, { DB: db, KV: kv });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns full integration details for a provisioned tenant", async () => {
    db.tables["api_keys"].push(ownerKeyRow("key-1", "proj-1", "org-1", "sk_live_abc"));
    db.tables["agents"].push({
      id: "agent-1",
      project_id: "proj-1",
      name: "Main Agent",
      created_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    });
    kv.put("api_key:key-1", "sk_live_abcrawsecret");

    const token = await tokenFor(USER_ONE);
    const res = await get("/integration", token, { DB: db, KV: kv });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: IntegrationData };
    expect(body.data.api_key).toBe("sk_live_abcrawsecret");
    expect(body.data.key_prefix).toBe("sk_live_abc");
    expect(body.data.key_retrievable).toBe(true);
    expect(body.data.project_id).toBe("proj-1");
    expect(body.data.agent_id).toBe("agent-1");
    expect(body.data.agent_name).toBe("Main Agent");
    expect(body.data.base_url).toBe("https://stratscope-api.khalidkhan.workers.dev");
    expect(body.data.ingest_endpoint).toBe("/v1/ingest/executions");
    expect(body.data.sdk).toEqual({
      python: "pip install stratscope",
      typescript: "npm install @stratscope/sdk",
    });
  });

  it("returns null api_key when the raw key is absent from KV", async () => {
    db.tables["api_keys"].push(ownerKeyRow("key-1", "proj-1", "org-1", "sk_live_abc"));
    db.tables["agents"].push({
      id: "agent-1",
      project_id: "proj-1",
      name: "Main Agent",
      created_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    });

    const token = await tokenFor(USER_ONE);
    const res = await get("/integration", token, { DB: db, KV: kv });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: IntegrationData };
    expect(body.data.api_key).toBeNull();
    expect(body.data.key_retrievable).toBe(false);
    expect(body.data.key_prefix).toBe("sk_live_abc");
    expect(body.data.project_id).toBe("proj-1");
    expect(body.data.agent_id).toBe("agent-1");
  });

  it("returns null api_key when the KV binding is unavailable", async () => {
    db.tables["api_keys"].push(ownerKeyRow("key-1", "proj-1", "org-1", "sk_live_abc"));
    kv.put("api_key:key-1", "sk_live_abcrawsecret");

    const token = await tokenFor(USER_ONE);
    const res = await get("/integration", token, { DB: db });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: IntegrationData };
    expect(body.data.api_key).toBeNull();
    expect(body.data.key_retrievable).toBe(false);
    expect(body.data.key_prefix).toBe("sk_live_abc");
  });

  it("returns nulls for a tenant with no owner key row", async () => {
    db.tables["agents"].push({
      id: "agent-1",
      project_id: "proj-1",
      name: "Main Agent",
      created_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    });

    const token = await tokenFor(USER_ONE);
    const res = await get("/integration", token, { DB: db, KV: kv });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: IntegrationData };
    expect(body.data.api_key).toBeNull();
    expect(body.data.key_prefix).toBeNull();
    expect(body.data.key_retrievable).toBe(false);
    expect(body.data.project_id).toBe("proj-1");
    expect(body.data.agent_id).toBe("agent-1");
    expect(body.data.agent_name).toBe("Main Agent");
  });

  it("never leaks another organization's key or agent", async () => {
    db.tables["api_keys"].push(
      ownerKeyRow("key-2", "proj-2", "org-2", "sk_live_org2"),
      ownerKeyRow("key-1", "proj-1", "org-1", "sk_live_org1")
    );
    db.tables["agents"].push(
      {
        id: "agent-2",
        project_id: "proj-2",
        name: "Other Agent",
        created_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "agent-1",
        project_id: "proj-1",
        name: "Main Agent",
        created_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      }
    );
    kv.put("api_key:key-2", "raw-key-of-org-2");

    const token = await tokenFor(USER_TWO);
    const res = await get("/integration", token, { DB: db, KV: kv });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: IntegrationData };
    expect(body.data.api_key).toBe("raw-key-of-org-2");
    expect(body.data.key_prefix).toBe("sk_live_org2");
    expect(body.data.project_id).toBe("proj-2");
    expect(body.data.agent_id).toBe("agent-2");
    expect(body.data.agent_name).toBe("Other Agent");

    const tokenOne = await tokenFor(USER_ONE);
    const resOne = await get("/integration", tokenOne, { DB: db, KV: kv });

    expect(resOne.status).toBe(200);
    const bodyOne = (await resOne.json()) as { data: IntegrationData };
    expect(bodyOne.data.api_key).toBeNull();
    expect(bodyOne.data.key_prefix).toBe("sk_live_org1");
    expect(bodyOne.data.key_retrievable).toBe(false);
    expect(bodyOne.data.project_id).toBe("proj-1");
    expect(bodyOne.data.agent_id).toBe("agent-1");
    expect(bodyOne.data.agent_name).toBe("Main Agent");
  });
});
