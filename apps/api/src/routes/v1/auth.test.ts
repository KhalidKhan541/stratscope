import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../../test/fakeD1.js";
import { authRoutes } from "./auth.js";
import type { Env } from "../../workers/env.js";

let db: FakeD1;
let app: Hono<{ Bindings: Env }>;

beforeEach(() => {
  db = new FakeD1({
    organizations: [{ id: "org-1", name: "Default Org", slug: "default", deleted_at: null }],
    users: [],
    sessions: [],
    oauth_accounts: [],
  });
  app = new Hono<{ Bindings: Env }>();
  app.route("/v1/auth", authRoutes);
});

function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return app.request(`/v1/auth${path}`, { method: "POST", headers, body: JSON.stringify(body) }, { DB: db, ENVIRONMENT: "test" });
}

describe("register endpoint", () => {
  it("registers and returns a session token", async () => {
    const res = await post("/register", {
      email: "jane@example.com",
      password: "supersecret123",
      name: "Jane",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { token: string; user: { email: string; provider: string } } };
    expect(body.data.token.length).toBeGreaterThanOrEqual(32);
    expect(body.data.user.email).toBe("jane@example.com");
    expect(body.data.user.provider).toBe("password");
  });

  it("rejects a duplicate email", async () => {
    await post("/register", { email: "jane@example.com", password: "supersecret123" });
    const res = await post("/register", { email: "jane@example.com", password: "another-secret" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects a short password", async () => {
    const res = await post("/register", { email: "jane@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await post("/register", { email: "not-an-email", password: "supersecret123" });
    expect(res.status).toBe(400);
  });
});

describe("login endpoint", () => {
  it("logs in with correct credentials", async () => {
    await post("/register", { email: "jane@example.com", password: "supersecret123" });
    const res = await post("/login", { email: "jane@example.com", password: "supersecret123" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { token: string } };
    expect(body.data.token.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects a wrong password", async () => {
    await post("/register", { email: "jane@example.com", password: "supersecret123" });
    const res = await post("/login", { email: "jane@example.com", password: "wrong-password" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an unknown email", async () => {
    const res = await post("/login", { email: "ghost@example.com", password: "whatever123" });
    expect(res.status).toBe(401);
  });
});

describe("session-protected endpoints", () => {
  it("returns 401 for /me without a token", async () => {
    const res = await app.request("/v1/auth/me", {}, { DB: db, ENVIRONMENT: "test" });
    expect(res.status).toBe(401);
  });

  it("returns the user for /me with a valid token", async () => {
    const reg = await post("/register", { email: "jane@example.com", password: "supersecret123" });
    const body = (await reg.json()) as { data: { token: string } };

    const res = await app.request(
      "/v1/auth/me",
      { headers: { Authorization: `Bearer ${body.data.token}` } },
      { DB: db, ENVIRONMENT: "test" }
    );
    expect(res.status).toBe(200);
    const me = (await res.json()) as { data: { email: string; provider: string } };
    expect(me.data.email).toBe("jane@example.com");
    expect(me.data.provider).toBe("password");
  });

  it("logs out and invalidates the token", async () => {
    const reg = await post("/register", { email: "jane@example.com", password: "supersecret123" });
    const body = (await reg.json()) as { data: { token: string } };

    const logout = await post("/logout", {}, body.data.token);
    expect(logout.status).toBe(200);

    const me = await app.request(
      "/v1/auth/me",
      { headers: { Authorization: `Bearer ${body.data.token}` } },
      { DB: db, ENVIRONMENT: "test" }
    );
    expect(me.status).toBe(401);
  });
});
