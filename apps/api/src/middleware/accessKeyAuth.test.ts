import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../test/fakeD1.js";
import { accessKeyAuth, getAccessGrant } from "./accessKeyAuth.js";
import { sha256Hex } from "../lib/accessGrants.js";
import type { Env } from "../workers/env.js";

const credential = "mag_0123456789abcdef0123456789abcdef";

async function makeApp(): Promise<{ app: Hono; db: FakeD1 }> {
  const db = new FakeD1({
    access_grants: [
      {
        id: "grant-1",
        organization_id: "org-1",
        name: "Magma",
        agent_ids: JSON.stringify(["agent-1"]),
        credential_hash: await sha256Hex(credential),
        key_prefix: "mag_01234567",
        status: "active",
        created_by: null,
        created_at: "2026-07-01T00:00:00.000Z",
        revoked_at: null,
        revoked_by: null,
      },
      {
        id: "grant-revoked",
        organization_id: "org-1",
        name: "Dead",
        agent_ids: JSON.stringify(["agent-1"]),
        credential_hash: await sha256Hex("mag_deadbeefdeadbeefdeadbeefdeadbeef"),
        key_prefix: "mag_deadbeef",
        status: "revoked",
        created_by: null,
        created_at: "2026-07-01T00:00:00.000Z",
        revoked_at: "2026-07-02T00:00:00.000Z",
        revoked_by: null,
      },
    ],
  });

  const app = new Hono<{ Bindings: Env }>();
  app.use("/access/*", accessKeyAuth);
  app.get("/access/me", (c) => {
    const grant = getAccessGrant(c);
    if (!grant) {
      return c.json({ error: "no grant" }, 401);
    }
    return c.json({ grant });
  });

  return { app, db };
}

function env(db: FakeD1): Env {
  return { DB: db, ENVIRONMENT: "test" };
}

describe("accessKeyAuth", () => {
  it("rejects requests without a Bearer credential", async () => {
    const { app, db } = await makeApp();
    const res = await app.request("/access/me", {}, env(db));
    expect(res.status).toBe(401);
  });

  it("rejects invalid credentials", async () => {
    const { app, db } = await makeApp();
    const res = await app.request("/access/me", {
      headers: { Authorization: "Bearer mag_wrongwrongwrongwrongwrong" },
    }, env(db));
    expect(res.status).toBe(401);
  });

  it("rejects revoked grants", async () => {
    const { app, db } = await makeApp();
    const res = await app.request("/access/me", {
      headers: { Authorization: "Bearer mag_deadbeefdeadbeefdeadbeefdeadbeef" },
    }, env(db));
    expect(res.status).toBe(401);
  });

  it("accepts a valid active credential and sets the grant", async () => {
    const { app, db } = await makeApp();
    const res = await app.request("/access/me", {
      headers: { Authorization: `Bearer ${credential}` },
    }, env(db));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { grant: { id: string; name: string; agent_ids: string[] } };
    expect(body.grant.id).toBe("grant-1");
    expect(body.grant.name).toBe("Magma");
    expect(body.grant.agent_ids).toEqual(["agent-1"]);
  });

  it("returns 500 when the database is unavailable", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("/access/*", accessKeyAuth);
    app.get("/access/me", (c) => c.json({ ok: true }));
    const res = await app.request("/access/me", {
      headers: { Authorization: `Bearer ${credential}` },
    }, { ENVIRONMENT: "test" } as Env);
    expect(res.status).toBe(500);
  });
});
