/**
 * Tenant provisioning.
 *
 * Every developer who requests an API key through the public contact flow
 * gets their own isolated tenant: a fresh organization, project, agent,
 * user account (email + generated password) and API key. Isolation is
 * mandatory — no two tenants may ever share an organization.
 *
 * The raw API key and the generated password are single-use secrets:
 * the password is stored only as a hash in `users.password_hash`, and the
 * raw key is stored in KV (api_key:<keyId>) so the tenant dashboard can
 * show it to the owner. Both are emailed exactly once.
 */

import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import { sha256Hex } from "./accessGrants.js";
import { hashPassword } from "./authSession.js";

export interface TenantProvision {
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id: string;
  readonly user_id: string;
  readonly api_key_id: string;
  readonly api_key: string;
  readonly password: string | null;
}

export const KEY_NAME_PREFIX = "owner-key:";
export const KV_KEY_PREFIX = "api_key:";

function randomHex(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(raw)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function uniqueSlug(db: D1Database, table: "organizations" | "projects", label: string): Promise<string> {
  return (async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const slug = `${label}-${randomHex(4)}`;
      const existing = await db
        .prepare(`SELECT id FROM ${table} WHERE slug = ?1 LIMIT 1`)
        .bind(slug)
        .first<{ id: string }>();
      if (!existing) {
        return slug;
      }
    }
    return `${label}-${randomHex(8)}`;
  })();
}

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const raw = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(raw, (b) => alphabet[b % alphabet.length]).join("");
}

export async function provisionTenant(
  db: D1Database,
  kv: KVNamespace | undefined,
  fields: {
    readonly email: string;
    readonly name: string;
    readonly agentName?: string;
    readonly existing?: { readonly userId: string; readonly organizationId: string };
  }
): Promise<TenantProvision> {
  const now = new Date().toISOString();
  const email = fields.email.trim().toLowerCase();
  const name = fields.name.trim();

  const organizationId = fields.existing?.organizationId ?? crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const agentId = crypto.randomUUID();
  const userId = fields.existing?.userId ?? crypto.randomUUID();
  const apiKeyId = crypto.randomUUID();

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const raw = crypto.getRandomValues(new Uint8Array(24));
  const secret = Array.from(raw)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const apiKey = `sk_live_${secret}`;

  if (!fields.existing) {
    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, plan, settings, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'free', '{}', ?4, ?4)`
      )
      .bind(organizationId, name, await uniqueSlug(db, "organizations", "org"), now)
      .run();
    await db
      .prepare(
        `INSERT INTO users (id, organization_id, clerk_user_id, email, name, role, status, password_hash, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'owner', 'active', ?6, ?7, ?7)`
      )
      .bind(userId, organizationId, `local_${userId}`, email, name, passwordHash, now)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE users SET name = ?1, updated_at = ?2 WHERE id = ?3`
      )
      .bind(name, now, userId)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO projects (id, organization_id, name, slug, environment, settings, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'production', '{}', ?5, ?5)`
    )
    .bind(projectId, organizationId, `${name}'s Project`, await uniqueSlug(db, "projects", "project"), now)
    .run();
  await db
    .prepare(
      `INSERT INTO agents (id, project_id, name, framework, config, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'custom', ?4, ?5, ?5)`
    )
    .bind(
      agentId,
      projectId,
      fields.agentName?.trim() || `${name}'s Agent`,
      JSON.stringify({ source: "tenant_provision" }),
      now
    )
    .run();
  await db
    .prepare(
      `INSERT INTO api_keys (id, project_id, name, key_hash, key_prefix, permissions, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, '[]', ?6)`
    )
    .bind(apiKeyId, projectId, `${KEY_NAME_PREFIX}${organizationId}`, await sha256Hex(apiKey), apiKey.slice(0, 12), now)
    .run();

  if (kv) {
    await kv.put(`${KV_KEY_PREFIX}${apiKeyId}`, apiKey);
  }

  return {
    organization_id: organizationId,
    project_id: projectId,
    agent_id: agentId,
    user_id: userId,
    api_key_id: apiKeyId,
    api_key: apiKey,
    password: fields.existing ? null : password,
  };
}
