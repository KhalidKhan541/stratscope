/**
 * OAuth session management.
 *
 * After a Google/GitHub OAuth login the API issues a random session token.
 * Only the SHA-256 hash is stored in D1 (sessions table). The user gets
 * the raw token once via redirect; the dashboard stores it and sends it
 * as `Authorization: Bearer <token>` on every request.
 */

import type { D1Database } from "@cloudflare/workers-types";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  readonly userId: string;
  readonly organizationId: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: string;
  readonly provider: string;
}

export interface OAuthProfile {
  readonly provider: "google" | "github";
  readonly providerUserId: string;
  readonly email: string;
  readonly name: string | null;
  readonly avatarUrl?: string;
}

export interface IssuedSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly user: SessionUser;
}

const PBKDF2_ITERATIONS = 100_000;

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    ),
    256
  );
  const hashHex = Array.from(new Uint8Array(key))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const saltHex = Array.from(salt)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > 10_000_000) {
    return false;
  }
  const saltHex = parts[2];
  const expectedHex = parts[3];
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(expectedHex)) {
    return false;
  }
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  const key = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    ),
    256
  );
  const actualHex = Array.from(new Uint8Array(key))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqualHex(actualHex, expectedHex);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function generateSessionToken(): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(raw)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function findUserByOAuth(
  db: D1Database,
  provider: "google" | "github",
  providerUserId: string
): Promise<{ user_id: string } | null> {
  return db
    .prepare(
      `SELECT user_id FROM oauth_accounts
       WHERE provider = ?1 AND provider_user_id = ?2`
    )
    .bind(provider, providerUserId)
    .first<{ user_id: string }>();
}

async function ensureOrganization(db: D1Database): Promise<string> {
  const now = new Date().toISOString();
  const orgRow = await db
    .prepare(
      `SELECT id FROM organizations
       WHERE deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .first<{ id: string }>();

  const organizationId = orgRow?.id ?? crypto.randomUUID();

  if (!orgRow) {
    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)`
      )
      .bind(organizationId, "Default Org", "default", now, now)
      .run();
  }

  return organizationId;
}

function randomHex(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(raw)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createOrganization(db: D1Database, name: string): Promise<string> {
  const now = new Date().toISOString();
  const organizationId = crypto.randomUUID();

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = `org-${randomHex(4)}`;
    const existing = await db
      .prepare(`SELECT id FROM organizations WHERE slug = ?1 LIMIT 1`)
      .bind(slug)
      .first<{ id: string }>();
    if (!existing) {
      await db
        .prepare(
          `INSERT INTO organizations (id, name, slug, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`
        )
        .bind(organizationId, name, slug, now, now)
        .run();
      return organizationId;
    }
  }

  return organizationId;
}

async function insertUser(
  db: D1Database,
  fields: {
    readonly userId: string;
    readonly organizationId: string;
    readonly clerkUserId: string;
    readonly email: string;
    readonly name: string | null;
    readonly passwordHash: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO users (id, organization_id, clerk_user_id, email, name, role, status, password_hash, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'owner', 'active', ?6, ?7, ?7)`
    )
    .bind(
      fields.userId,
      fields.organizationId,
      fields.clerkUserId,
      fields.email,
      fields.name,
      fields.passwordHash,
      now
    )
    .run();
}

function toSessionUser(
  user: {
    id: string;
    organization_id: string;
    email: string;
    name: string | null;
    role: string;
  },
  provider: string
): SessionUser {
  return {
    userId: String(user.id),
    organizationId: String(user.organization_id),
    email: String(user.email),
    name: user.name ? String(user.name) : null,
    role: String(user.role),
    provider,
  };
}

export async function upsertOAuthUser(
  db: D1Database,
  profile: OAuthProfile
): Promise<SessionUser> {
  const existing = await findUserByOAuth(db, profile.provider, profile.providerUserId);

  if (existing) {
    const user = await db
      .prepare(
        `SELECT u.id, u.organization_id, u.email, u.name, u.role
         FROM users u
         WHERE u.id = ?1 AND u.deleted_at IS NULL`
      )
      .bind(existing.user_id)
      .first<{
        id: string;
        organization_id: string;
        email: string;
        name: string | null;
        role: string;
      }>();

    if (user) {
      return toSessionUser(user, profile.provider);
    }
  }

  const userId = crypto.randomUUID();
  const organizationId = await ensureOrganization(db);

  await insertUser(db, {
    userId,
    organizationId,
    clerkUserId: `${profile.provider}_${profile.providerUserId}`,
    email: profile.email,
    name: profile.name,
    passwordHash: null,
  });

  await db
    .prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, name, avatar_url, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      profile.provider,
      profile.providerUserId,
      profile.email,
      profile.name,
      profile.avatarUrl ?? null,
      now
    )
    .run();

  return {
    userId,
    organizationId,
    email: profile.email,
    name: profile.name,
    role: "owner",
    provider: profile.provider,
  };
}

export type PasswordRegisterResult =
  | { readonly ok: true; readonly user: SessionUser }
  | { readonly ok: false; readonly code: "EMAIL_TAKEN" };

export async function registerWithPassword(
  db: D1Database,
  fields: {
    readonly email: string;
    readonly password: string;
    readonly name?: string;
  }
): Promise<PasswordRegisterResult> {
  const email = fields.email.trim().toLowerCase();
  const existing = await db
    .prepare(
      `SELECT id FROM users
       WHERE email = ?1 AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(email)
    .first<{ id: string }>();

  if (existing) {
    return { ok: false, code: "EMAIL_TAKEN" };
  }

  const passwordHash = await hashPassword(fields.password);
  const userId = crypto.randomUUID();
  const organizationId = await createOrganization(
    db,
    fields.name?.trim() || "My Organization"
  );

  await insertUser(db, {
    userId,
    organizationId,
    clerkUserId: `local_${userId}`,
    email,
    name: fields.name?.trim() || null,
    passwordHash,
  });

  const user = await db
    .prepare(
      `SELECT id, organization_id, email, name, role
       FROM users
       WHERE id = ?1`
    )
    .bind(userId)
    .first<{
      id: string;
      organization_id: string;
      email: string;
      name: string | null;
      role: string;
    }>();

  if (!user) {
    return { ok: false, code: "EMAIL_TAKEN" };
  }

  return { ok: true, user: toSessionUser(user, "password") };
}

export async function loginWithPassword(
  db: D1Database,
  email: string,
  password: string
): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  const user = await db
    .prepare(
      `SELECT id, organization_id, email, name, role, password_hash
       FROM users
       WHERE email = ?1 AND password_hash IS NOT NULL AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(normalized)
    .first<{
      id: string;
      organization_id: string;
      email: string;
      name: string | null;
      role: string;
      password_hash: string;
    }>();

  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, String(user.password_hash));
  if (!valid) {
    return null;
  }

  return toSessionUser(
    {
      id: user.id,
      organization_id: user.organization_id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    "password"
  );
}

export async function createSession(
  db: D1Database,
  options: {
    readonly user: SessionUser;
    readonly ip?: string;
    readonly userAgent?: string;
  }
): Promise<IssuedSession> {
  const token = await generateSessionToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, organization_id, provider, token_hash, expires_at, ip, user_agent, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
    .bind(
      id,
      options.user.userId,
      options.user.organizationId,
      options.user.provider,
      tokenHash,
      expiresAt,
      options.ip ?? null,
      options.userAgent ? options.userAgent.slice(0, 512) : null,
      new Date().toISOString()
    )
    .run();

  return { token, expiresAt, user: options.user };
}

export async function verifySessionToken(
  db: D1Database,
  token: string
): Promise<SessionUser | null> {
  if (token.length < 16) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.user_id, s.organization_id, s.provider, s.expires_at,
              u.email, u.name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND u.deleted_at IS NULL`
    )
    .bind(tokenHash, new Date().toISOString())
    .first<{
      user_id: string;
      organization_id: string;
      provider: string;
      expires_at: string;
      email: string;
      name: string | null;
      role: string;
    }>();

  if (!row) {
    return null;
  }

  return {
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    role: String(row.role),
    provider: String(row.provider) as "google" | "github",
  };
}

export async function deleteSession(
  db: D1Database,
  token: string
): Promise<boolean> {
  const tokenHash = await sha256Hex(token);
  const result = await db
    .prepare(`DELETE FROM sessions WHERE token_hash = ?1`)
    .bind(tokenHash)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
