import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { FakeD1 } from "../../test/fakeD1.js";
import { contactRoutes } from "./contact.js";
import { sendEmail, EmailError } from "../../lib/email.js";
import type { Env } from "../../workers/env.js";

vi.mock("../../lib/email.js", () => {
  class MockEmailError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "EmailError";
      this.code = code;
    }
  }
  return {
    EmailError: MockEmailError,
    sendEmail: vi.fn(),
  };
});

const mockedSendEmail = vi.mocked(sendEmail);

class FakeKV {
  private store = new Map<string, string>();

  async get<T>(key: string, type?: "json"): Promise<T | null> {
    const value = this.store.get(key);
    if (value === undefined) {
      return null;
    }
    if (type === "json") {
      return JSON.parse(value) as T;
    }
    return value as unknown as T;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

let db: FakeD1;
let kv: FakeKV;
let app: Hono<{ Bindings: Env }>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedSendEmail.mockResolvedValue(undefined);

  db = new FakeD1({
    contact_requests: [],
    api_keys: [],
    organizations: [],
    projects: [],
    agents: [],
    users: [],
  });
  kv = new FakeKV();
  app = new Hono<{ Bindings: Env }>();
  app.route("/v1/contact", contactRoutes);
});

function post(path: string, body: unknown) {
  return app.request(
    `/v1/contact${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { DB: db, KV: kv, ENVIRONMENT: "test", SMTP_USER: "owner@stratscope.app" }
  );
}

describe("POST /v1/contact", () => {
  it("records a request and emails the API key when request_key is true", async () => {
    const res = await post("", {
      name: "Jane Doe",
      email: "jane@example.com",
      request_key: true,
      subject: "API key please",
      message: "I want to build an agent",
      agent_name: "jane-bot",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { request_id: string; key_sent: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.key_sent).toBe(true);
    expect(typeof body.data.request_id).toBe("string");

    const requests = db.tables["contact_requests"] ?? [];
    expect(requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
      name: "Jane Doe",
      email: "jane@example.com",
      subject: "API key please",
      message: "I want to build an agent",
      agent_name: "jane-bot",
      request_key: 1,
      status: "sent",
    });

    const keys = db.tables["api_keys"] ?? [];
    expect(keys.length).toBe(1);
    expect(keys[0]).toMatchObject({
      name: expect.stringMatching(/^owner-key:/),
      permissions: "[]",
    });
    expect(String(keys[0]?.["key_prefix"] ?? "").startsWith("sk_live_")).toBe(true);
    expect(keys[0]?.["key_hash"]).toBeTypeOf("string");

    expect(db.tables["organizations"] ?? []).toHaveLength(1);
    expect(db.tables["projects"] ?? []).toHaveLength(1);
    expect(db.tables["agents"] ?? []).toHaveLength(1);
    expect(db.tables["users"] ?? []).toHaveLength(1);
    const provisionedUser = (db.tables["users"] ?? [])[0] as Record<string, unknown>;
    expect(String(provisionedUser["password_hash"] ?? "")).toMatch(/^pbkdf2\$/);
    expect(String(provisionedUser["password_hash"] ?? "")).not.toContain("provision");

    const keyId = keys[0]?.["id"];
    expect(String(keyId)).toBeTypeOf("string");
    expect(kv.keys().some((k) => k === `api_key:${keyId}`)).toBe(true);

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    const keyEmail = mockedSendEmail.mock.calls[0]?.[1];
    expect(keyEmail?.to).toBe("jane@example.com");
    expect(keyEmail?.subject).toBe("Your StratScope API key and dashboard access");
    expect(keyEmail?.text).toContain("sk_live_");
    expect(keyEmail?.text).toContain("auth.html");
    expect(keyEmail?.text).toContain("Password: ");

    const ownerEmail = mockedSendEmail.mock.calls[1]?.[1];
    expect(ownerEmail?.to).toBe("owner@stratscope.app");
  });

  it("provisions isolated tenants for different requesters", async () => {
    await post("", { name: "Jane", email: "jane@example.com", request_key: true });
    await post("", { name: "John", email: "john@example.com", request_key: true });

    const organizations = db.tables["organizations"] ?? [];
    expect(organizations).toHaveLength(2);
    const orgIds = new Set(organizations.map((o) => o["id"]));
    expect(orgIds.size).toBe(2);

    const projects = db.tables["projects"] ?? [];
    expect(projects).toHaveLength(2);
    const projectOrgs = new Set(projects.map((p) => p["organization_id"]));
    expect(projectOrgs.size).toBe(2);

    const keys = db.tables["api_keys"] ?? [];
    expect(keys).toHaveLength(2);
    const keyOrgs = keys.map((k) => {
      const name = String(k["name"] ?? "");
      const match = name.match(/^owner-key:(.+)$/);
      return match?.[1];
    });
    expect(new Set(keyOrgs).size).toBe(2);

    const requests = db.tables["contact_requests"] ?? [];
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(String(request["organization_id"] ?? "")).toBeTypeOf("string");
      expect(String(request["project_id"] ?? "")).toBeTypeOf("string");
      expect(String(request["agent_id"] ?? "")).toBeTypeOf("string");
      expect(String(request["user_id"] ?? "")).toBeTypeOf("string");
      expect(String(request["api_key_id"] ?? "")).toBeTypeOf("string");
    }
  });

  it("reuses an existing user's organization instead of creating a new tenant", async () => {
    const now = new Date().toISOString();
    const orgId = "92c85ed7-1d4a-4efc-ac37-275db661302e";
    const userId = "existing-user-1";
    (db.tables["organizations"] ?? []).push({
      id: orgId,
      name: "Existing Org",
      slug: "org-existing",
      plan: "free",
      settings: "{}",
      created_at: now,
      updated_at: now,
    });
    (db.tables["users"] ?? []).push({
      id: userId,
      organization_id: orgId,
      clerk_user_id: `local_${userId}`,
      email: "jane@example.com",
      name: "Jane Doe",
      role: "owner",
      status: "active",
      password_hash: "pbkdf2$existing-hash",
      created_at: now,
      updated_at: now,
    });

    const res = await post("", {
      name: "Jane Doe",
      email: "jane@example.com",
      request_key: true,
      agent_name: "jane-bot",
    });

    expect(res.status).toBe(201);

    expect(db.tables["organizations"] ?? []).toHaveLength(1);
    expect(db.tables["users"] ?? []).toHaveLength(1);
    expect(db.tables["projects"] ?? []).toHaveLength(1);
    expect(db.tables["agents"] ?? []).toHaveLength(1);

    const keys = db.tables["api_keys"] ?? [];
    expect(keys).toHaveLength(1);
    expect(String(keys[0]?.["name"] ?? "")).toBe(`owner-key:${orgId}`);
    const keyId = keys[0]?.["id"];
    expect(kv.keys().some((k) => k === `api_key:${keyId}`)).toBe(true);

    const requests = db.tables["contact_requests"] ?? [];
    expect(requests[0]).toMatchObject({
      organization_id: orgId,
      user_id: userId,
      project_id: expect.any(String),
      agent_id: expect.any(String),
      api_key_id: expect.any(String),
    });

    const keyEmail = mockedSendEmail.mock.calls[0]?.[1];
    expect(keyEmail?.text).toContain("You already have a dashboard account");
    expect(keyEmail?.text).not.toContain("Password:");
  });

  it("records a plain request without a key when request_key is false", async () => {
    const res = await post("", {
      name: "Jane Doe",
      email: "jane@example.com",
      message: "Hello",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { key_sent: boolean } };
    expect(body.data.key_sent).toBe(false);

    const requests = db.tables["contact_requests"] ?? [];
    expect(requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
      email: "jane@example.com",
      request_key: 0,
      status: "received",
    });
    expect(db.tables["api_keys"] ?? []).toHaveLength(0);

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    expect(mockedSendEmail.mock.calls[0]?.[1]?.to).toBe("jane@example.com");
    expect(mockedSendEmail.mock.calls[1]?.[1]?.to).toBe("owner@stratscope.app");
  });

  it("still returns 201 with key_sent false when the key email fails", async () => {
    mockedSendEmail.mockRejectedValue(new EmailError("SMTP_REJECTED", "server said no"));

    const res = await post("", {
      name: "Jane Doe",
      email: "jane@example.com",
      request_key: true,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: { request_id: string; key_sent: boolean };
      message?: string;
    };
    expect(body.success).toBe(true);
    expect(body.data.key_sent).toBe(false);
    expect(typeof body.message).toBe("string");
    expect(JSON.stringify(body)).not.toContain("SMTP");

    const requests = db.tables["contact_requests"] ?? [];
    expect(requests[0]?.["status"]).toBe("key_failed");
    expect(db.tables["api_keys"] ?? []).toHaveLength(1);
    expect(db.tables["organizations"] ?? []).toHaveLength(1);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await post("", { name: "Jane", email: "not-an-email" });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(db.tables["contact_requests"] ?? []).toHaveLength(0);
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("rate limits after 3 requests per email per day", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await post("", { name: "Jane", email: "jane@example.com" });
      expect(res.status).toBe(201);
    }

    const blocked = await post("", { name: "Jane", email: "jane@example.com" });
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(db.tables["contact_requests"] ?? []).toHaveLength(3);
  });

  it("allows a different email even when one is rate limited", async () => {
    for (let i = 0; i < 3; i++) {
      await post("", { name: "Jane", email: "jane@example.com" });
    }

    const res = await post("", { name: "John", email: "john@example.com" });
    expect(res.status).toBe(201);
  });

  it("treats a honeypot submission as success without doing anything", async () => {
    const res = await post("", {
      name: "Bot",
      email: "bot@spam.example.com",
      request_key: true,
      website: "http://spam.example.com",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { key_sent: boolean } };
    expect(body.success).toBe(true);

    expect(db.tables["contact_requests"] ?? []).toHaveLength(0);
    expect(db.tables["api_keys"] ?? []).toHaveLength(0);
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(kv.keys().some((k) => k.startsWith("contact:bot@spam.example.com"))).toBe(false);
  });
});
