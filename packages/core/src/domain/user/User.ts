/**
 * User - a human user of the StratScope platform.
 *
 * Users belong to one or more organizations and can be assigned roles
 * within each organization for access control.
 */

import type { UserId, OrganizationId } from "../../shared/ids/Ids";

/** The role a user has within an organization. */
export type UserRole = "owner" | "admin" | "member" | "viewer";

/** The status of a user account. */
export type UserStatus = "active" | "suspended" | "deactivated";

/** The canonical user record. */
export interface User {
  /** Unique identifier for this user. */
  readonly user_id: UserId;
  /** External authentication provider ID (e.g., Clerk user ID). */
  readonly external_id: string;
  /** Primary email address. */
  readonly email: string;
  /** Display name. */
  readonly display_name: string;
  /** URL to the user's avatar image. */
  readonly avatar_url?: string;
  /** Current status. */
  readonly status: UserStatus;
  /** Organization memberships. */
  readonly organization_memberships: ReadonlyArray<OrganizationMembership>;
  /** ISO-8601 timestamp when this user was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this user last logged in. */
  readonly last_login_at?: string;
}

/** A user's membership in an organization. */
export interface OrganizationMembership {
  /** Organization ID. */
  readonly organization_id: OrganizationId;
  /** User's role in this organization. */
  readonly role: UserRole;
  /** ISO-8601 timestamp when the membership was created. */
  readonly joined_at: string;
}

/**
 * Creates a new User record.
 */
export function createUser(overrides: {
  user_id: UserId;
  external_id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
}): User {
  return {
    user_id: overrides.user_id,
    external_id: overrides.external_id,
    email: overrides.email,
    display_name: overrides.display_name,
    avatar_url: overrides.avatar_url,
    status: "active",
    organization_memberships: [],
    created_at: new Date().toISOString(),
  };
}
