/**
 * Owner API-key context resolution.
 *
 * Owner-side routes (grant management, audit) authenticate with a regular
 * API key (apiKeyAuth) and resolve the owning organization through the
 * key's project. Mirrors the pattern used by the ingest routes.
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { Context } from "hono";
import { getApiKeyAuth } from "../middleware/apiKeyAuth.js";

export interface OwnerContext {
  readonly keyId: string;
  readonly projectId: string;
  readonly organizationId: string;
}

export async function resolveOwnerContext(
  c: { env: { DB?: D1Database } }
): Promise<OwnerContext | null> {
  const db = c.env.DB;
  if (!db) {
    return null;
  }

  const auth = getApiKeyAuth(c as Context);
  if (!auth) {
    return null;
  }

  const row = await db
    .prepare(
      `SELECT k.id AS key_id, k.project_id, p.organization_id
       FROM api_keys k
       JOIN projects p ON p.id = k.project_id
       WHERE k.id = ?1 AND k.deleted_at IS NULL`
    )
    .bind(auth.id)
    .first<{ key_id: string; project_id: string; organization_id: string }>();

  if (!row) {
    return null;
  }

  return {
    keyId: String(row.key_id),
    projectId: String(row.project_id),
    organizationId: String(row.organization_id),
  };
}
