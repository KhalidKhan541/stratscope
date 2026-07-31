/**
 * Immutable artifact produced by a pipeline stage.
 *
 * Every pipeline stage creates a new artifact. Artifacts are never modified
 * after creation. They form the audit trail and knowledge base of the
 * Execution Intelligence Operating System.
 */

import type {
  ArtifactId,
  ExecutionId,
  OrganizationId,
  ProjectId,
} from "../../shared/ids/Ids";
import type { ArtifactType } from "./ArtifactType";

/**
 * The canonical artifact record.
 */
export interface Artifact {
  /** Unique identifier for this artifact. */
  readonly artifact_id: ArtifactId;
  /** Execution this artifact belongs to. */
  readonly execution_id: ExecutionId;
  /** Organization this artifact belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this artifact belongs to. */
  readonly project_id: ProjectId;
  /** Type of artifact. */
  readonly type: ArtifactType;
  /** Pipeline stage version that produced this artifact. */
  readonly pipeline_version: string;
  /** The artifact content as a structured object. */
  readonly content: Record<string, unknown>;
  /** Hash of the content for integrity verification. */
  readonly content_hash: string;
  /** Size of the artifact content in bytes. */
  readonly size_bytes: number;
  /** ISO-8601 timestamp when this artifact was created. */
  readonly created_at: string;
  /** Optional human-readable name for this artifact. */
  readonly name?: string;
  /** Optional description of what this artifact contains. */
  readonly description?: string;
}

/**
 * Creates a new Artifact record.
 */
export function createArtifact(overrides: {
  artifact_id: ArtifactId;
  execution_id: ExecutionId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  type: ArtifactType;
  pipeline_version: string;
  content: Record<string, unknown>;
  content_hash: string;
  size_bytes: number;
  name?: string;
  description?: string;
}): Artifact {
  return {
    artifact_id: overrides.artifact_id,
    execution_id: overrides.execution_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    type: overrides.type,
    pipeline_version: overrides.pipeline_version,
    content: overrides.content,
    content_hash: overrides.content_hash,
    size_bytes: overrides.size_bytes,
    created_at: new Date().toISOString(),
    name: overrides.name,
    description: overrides.description,
  };
}
