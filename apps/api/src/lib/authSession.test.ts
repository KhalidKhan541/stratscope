import { describe, it, expect } from "vitest";
import { FakeD1 } from "../test/fakeD1.js";
import {
  hashPassword,
  verifyPassword,
  registerWithPassword,
  loginWithPassword,
  createSession,
  verifySessionToken,
  deleteSession,
} from "./authSession.js";

function makeDb(): FakeD1 {
  return new FakeD1({
    organizations: [{ id: "org-1", name: "Default Org", slug: "default", deleted_at: null }],
    users: [],
    sessions: [],
    oauth_accounts: [],
  });
}

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const stored = await hashPassword("correct-horse-battery");
    expect(stored.startsWith("pbkdf2$")).toBe(true);
    await expect(verifyPassword("correct-horse-battery", stored)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("right-password");
    await expect(verifyPassword("wrong-password", stored)).resolves.toBe(false);
  });

  it("rejects tampered stored values", async () => {
    await expect(verifyPassword("any", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("any", "pbkdf2$0$00$00")).resolves.toBe(false);
  });

  it("produces unique salts per hash", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("registerWithPassword", () => {
  it("creates a user with a hashed password", async () => {
    const db = makeDb();
    const result = await registerWithPassword(db, {
      email: "jane@example.com",
      password: "supersecret123",
      name: "Jane",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.email).toBe("jane@example.com");
    expect(result.user.provider).toBe("password");
    expect(result.user.role).toBe("owner");

    const users = db.tables["users"];
    expect(users).toHaveLength(1);
    expect(users[0]["email"]).toBe("jane@example.com");
    expect(String(users[0]["password_hash"]).startsWith("pbkdf2$")).toBe(true);
    expect(users[0]["password_hash"]).not.toBe("supersecret123");
  });

  it("rejects a duplicate email", async () => {
    const db = makeDb();
    await registerWithPassword(db, { email: "jane@example.com", password: "supersecret123" });
    const second = await registerWithPassword(db, {
      email: "JANE@example.com",
      password: "another-secret",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("EMAIL_TAKEN");
    expect(db.tables["users"]).toHaveLength(1);
  });
});

describe("loginWithPassword", () => {
  it("logs in with the correct password", async () => {
    const db = makeDb();
    await registerWithPassword(db, { email: "jane@example.com", password: "supersecret123" });
    const user = await loginWithPassword(db, "jane@example.com", "supersecret123");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("jane@example.com");
  });

  it("rejects a wrong password", async () => {
    const db = makeDb();
    await registerWithPassword(db, { email: "jane@example.com", password: "supersecret123" });
    await expect(loginWithPassword(db, "jane@example.com", "wrong")).resolves.toBeNull();
  });

  it("rejects an unknown email", async () => {
    const db = makeDb();
    await expect(loginWithPassword(db, "ghost@example.com", "whatever123")).resolves.toBeNull();
  });
});

describe("session roundtrip", () => {
  it("creates, verifies and deletes a session", async () => {
    const db = makeDb();
    const registered = await registerWithPassword(db, {
      email: "jane@example.com",
      password: "supersecret123",
    });
    if (!registered.ok) throw new Error("registration failed");

    const session = await createSession(db, { user: registered.user });
    expect(session.token.length).toBeGreaterThanOrEqual(32);

    const verified = await verifySessionToken(db, session.token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(registered.user.userId);
    expect(verified?.provider).toBe("password");

    await expect(deleteSession(db, session.token)).resolves.toBe(true);
    await expect(verifySessionToken(db, session.token)).resolves.toBeNull();
  });

  it("rejects an unknown token", async () => {
    const db = makeDb();
    await expect(verifySessionToken(db, "deadbeef".repeat(8))).resolves.toBeNull();
  });
});
