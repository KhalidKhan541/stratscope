/**
 * API key - authentication credential for programmatic access.
 *
 * API keys are hashed before storage. Only the hash and a truncated
 * preview are stored. The raw key is shown once at creation time.
 */

import type { ApiKeyId, OrganizationId, ProjectId, UserId } from "../../shared/ids/Ids";

/** The status of an API key. */
export type ApiKeyStatus = "active" | "revoked" | "expired";

/** The scope/permissions of an API key. */
export type ApiKeyScope = "read" | "write" | "admin";

/** The canonical API key record. */
export interface ApiKey {
  /** Unique identifier for this API key record. */
  readonly api_key_id: ApiKeyId;
  /** Organization this API key belongs to. */
  readonly organization_id: OrganizationId;
  /** Optional project this API key is scoped to. */
  readonly project_id: ProjectId | null;
  /** User who created this API key. */
  readonly created_by_user_id: UserId;
  /** Human-readable name for this key. */
  readonly name: string;
  /** Hashed representation of the API key (never store raw keys). */
  readonly key_hash: string;
  /** Truncated preview of the key for display (e.g., "sk_...abc"). */
  readonly key_preview: string;
  /** Permission scope of this key. */
  readonly scope: ApiKeyScope;
  /** Current status. */
  readonly status: ApiKeyStatus;
  /** ISO-8601 timestamp when this key was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this key was last used. */
  readonly last_used_at?: string;
  /** ISO-8601 timestamp when this key expires, if applicable. */
  readonly expires_at?: string;
  /** ISO-8601 timestamp when this key was revoked, if applicable. */
  readonly revoked_at?: string;
  /** Custom metadata attached to this key. */
  readonly metadata: Record<string, unknown>;
}

/**
 * Creates a new ApiKey record.
 */
export function createApiKey(overrides: {
  api_key_id: ApiKeyId;
  organization_id: OrganizationId;
  created_by_user_id: UserId;
  name: string;
  key_hash: string;
  key_preview: string;
  scope?: ApiKeyScope;
  project_id?: ProjectId | null;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}): ApiKey {
  return {
    api_key_id: overrides.api_key_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id ?? null,
    created_by_user_id: overrides.created_by_user_id,
    name: overrides.name,
    key_hash: overrides.key_hash,
    key_preview: overrides.key_preview,
    scope: overrides.scope ?? "read",
    status: "active",
    created_at: new Date().toISOString(),
    expires_at: overrides.expires_at,
    metadata: overrides.metadata ?? {},
  };
}
