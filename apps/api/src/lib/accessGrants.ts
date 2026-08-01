/**
 * Access grant library.
 *
 * Read-only credentials issued to external data consumers (e.g. Magma).
 * A credential is shown once at issuance as `mag_<secret>`; only its
 * SHA-256 hash is stored. Grants are bound to one organization and an
 * explicit list of agent_ids — the grant can only read those agents.
 */

import type { D1Database } from "@cloudflare/workers-types";

export interface AccessGrant {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly agent_ids: string[];
  readonly status: "active" | "revoked";
  readonly key_prefix: string;
  readonly created_by: string | null;
  readonly created_at: string;
  readonly revoked_at: string | null;
  readonly revoked_by: string | null;
}

export interface IssuedAccessGrant {
  readonly grant: AccessGrant;
  readonly credential: string;
}

export interface AccessGrantOptions {
  readonly organizationId: string;
  readonly name: string;
  readonly agentIds: string[];
  readonly createdBy?: string;
}

const CREDENTIAL_PREFIX = "mag_";
const CREDENTIAL_BYTES = 24;

export function generateCredential(): string {
  const raw = crypto.getRandomValues(new Uint8Array(CREDENTIAL_BYTES));
  const hex = Array.from(raw)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${CREDENTIAL_PREFIX}${hex}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function credentialKeyPrefix(credential: string): string {
  return credential.length > 12 ? credential.slice(0, 12) : credential;
}

export async function issueAccessGrant(
  db: D1Database,
  options: AccessGrantOptions
): Promise<IssuedAccessGrant> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const credential = generateCredential();
  const credentialHash = await sha256Hex(credential);

  await db
    .prepare(
      `INSERT INTO access_grants (id, organization_id, name, agent_ids, credential_hash, key_prefix, status, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8)`
    )
    .bind(
      id,
      options.organizationId,
      options.name,
      JSON.stringify(options.agentIds),
      credentialHash,
      credentialKeyPrefix(credential),
      options.createdBy ?? null,
      now
    )
    .run();

  return {
    grant: {
      id,
      organization_id: options.organizationId,
      name: options.name,
      agent_ids: options.agentIds,
      status: "active",
      key_prefix: credentialKeyPrefix(credential),
      created_by: options.createdBy ?? null,
      created_at: now,
      revoked_at: null,
      revoked_by: null,
    },
    credential,
  };
}

export async function verifyAccessCredential(
  db: D1Database,
  credential: string
): Promise<AccessGrant | null> {
  if (!credential.startsWith(CREDENTIAL_PREFIX)) {
    return null;
  }

  const credentialHash = await sha256Hex(credential);
  const row = await db
    .prepare(`SELECT * FROM access_grants WHERE credential_hash = ?1 AND status = 'active'`)
    .bind(credentialHash)
    .first<Record<string, unknown>>();

  if (!row) {
    return null;
  }

  return rowToGrant(row);
}

export async function getAccessGrantById(
  db: D1Database,
  grantId: string
): Promise<AccessGrant | null> {
  const row = await db
    .prepare(`SELECT * FROM access_grants WHERE id = ?1`)
    .bind(grantId)
    .first<Record<string, unknown>>();

  if (!row) {
    return null;
  }

  return rowToGrant(row);
}

export async function listAccessGrants(
  db: D1Database,
  organizationId: string
): Promise<AccessGrant[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM access_grants
       WHERE organization_id = ?1
       ORDER BY created_at DESC`
    )
    .bind(organizationId)
    .all<Record<string, unknown>>();

  return rows.results.map(rowToGrant);
}

export async function revokeAccessGrant(
  db: D1Database,
  grantId: string,
  revokedBy?: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE access_grants
       SET status = 'revoked', revoked_at = ?1, revoked_by = ?2
       WHERE id = ?3 AND status = 'active'`
    )
    .bind(new Date().toISOString(), revokedBy ?? null, grantId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

function rowToGrant(row: Record<string, unknown>): AccessGrant {
  return {
    id: String(row["id"]),
    organization_id: String(row["organization_id"]),
    name: String(row["name"]),
    agent_ids: JSON.parse(String(row["agent_ids"] ?? "[]")) as string[],
    status: (String(row["status"] ?? "active") as "active" | "revoked"),
    key_prefix: String(row["key_prefix"] ?? ""),
    created_by: row["created_by"] ? String(row["created_by"]) : null,
    created_at: String(row["created_at"]),
    revoked_at: row["revoked_at"] ? String(row["revoked_at"]) : null,
    revoked_by: row["revoked_by"] ? String(row["revoked_by"]) : null,
  };
}
