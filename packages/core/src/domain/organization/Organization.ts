/**
 * Organization - the tenant boundary in StratScope.
 *
 * Every resource belongs to an organization. Organizations provide
 * isolation for data, billing, and access control.
 */

import type { OrganizationId, UserId } from "../../shared/ids/Ids";

/** The plan tier for an organization. */
export type OrganizationPlan = "free" | "starter" | "professional" | "enterprise";

/** The status of an organization. */
export type OrganizationStatus = "active" | "suspended" | "deactivated";

/** The canonical organization record. */
export interface Organization {
  /** Unique identifier for this organization. */
  readonly organization_id: OrganizationId;
  /** Human-readable name. */
  readonly name: string;
  /** Slug for URL-friendly identification. */
  readonly slug: string;
  /** Organization plan tier. */
  readonly plan: OrganizationPlan;
  /** Current status. */
  readonly status: OrganizationStatus;
  /** Owner user ID. */
  readonly owner_user_id: UserId;
  /** Billing email address. */
  readonly billing_email?: string;
  /** Maximum number of projects allowed. */
  readonly max_projects: number;
  /** Maximum number of executions per month. */
  readonly max_executions_per_month: number;
  /** Custom settings for this organization. */
  readonly settings: Record<string, unknown>;
  /** ISO-8601 timestamp when this organization was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this organization was last updated. */
  readonly updated_at: string;
}

/**
 * Creates a new Organization record.
 */
export function createOrganization(overrides: {
  organization_id: OrganizationId;
  name: string;
  slug: string;
  owner_user_id: UserId;
  plan?: OrganizationPlan;
  billing_email?: string;
}): Organization {
  const now = new Date().toISOString();
  return {
    organization_id: overrides.organization_id,
    name: overrides.name,
    slug: overrides.slug,
    plan: overrides.plan ?? "free",
    status: "active",
    owner_user_id: overrides.owner_user_id,
    billing_email: overrides.billing_email,
    max_projects: 5,
    max_executions_per_month: 10_000,
    settings: {},
    created_at: now,
    updated_at: now,
  };
}
