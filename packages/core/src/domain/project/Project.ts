/**
 * Project - a logical grouping within an organization.
 *
 * Projects group executions, agents, and configurations together.
 */

import type { ProjectId, OrganizationId } from "../../shared/ids/Ids";

/** The status of a project. */
export type ProjectStatus = "active" | "archived" | "deleted";

/** The canonical project record. */
export interface Project {
  /** Unique identifier for this project. */
  readonly project_id: ProjectId;
  /** Organization this project belongs to. */
  readonly organization_id: OrganizationId;
  /** Human-readable name. */
  readonly name: string;
  /** Optional description of the project. */
  readonly description: string;
  /** Slug for URL-friendly identification. */
  readonly slug: string;
  /** Current status. */
  readonly status: ProjectStatus;
  /** Custom settings for this project. */
  readonly settings: Record<string, unknown>;
  /** Default model for executions in this project. */
  readonly default_model?: string;
  /** Default provider for executions in this project. */
  readonly default_provider?: string;
  /** ISO-8601 timestamp when this project was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this project was last updated. */
  readonly updated_at: string;
}

/**
 * Creates a new Project record.
 */
export function createProject(overrides: {
  project_id: ProjectId;
  organization_id: OrganizationId;
  name: string;
  description?: string;
  slug: string;
  default_model?: string;
  default_provider?: string;
}): Project {
  const now = new Date().toISOString();
  return {
    project_id: overrides.project_id,
    organization_id: overrides.organization_id,
    name: overrides.name,
    description: overrides.description ?? "",
    slug: overrides.slug,
    status: "active",
    settings: {},
    default_model: overrides.default_model,
    default_provider: overrides.default_provider,
    created_at: now,
    updated_at: now,
  };
}
