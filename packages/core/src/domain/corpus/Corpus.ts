/**
 * Corpus — A curated collection of execution intelligence artifacts
 * organized for research consumption.
 *
 * A corpus groups related datasets, benchmarks, and evaluations
 * into a coherent research package.
 */

import type { OrganizationId, ProjectId } from "../../shared/ids/Ids";

/** The lifecycle status of a corpus. */
export type CorpusStatus = "draft" | "published" | "archived";

/** A curated research corpus grouping datasets, benchmarks, and evaluations. */
export interface Corpus {
  /** Unique identifier for this corpus. */
  readonly id: string;
  /** Organization this corpus belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this corpus belongs to. */
  readonly project_id: ProjectId;
  /** Human-readable name. */
  readonly name: string;
  /** Detailed description of the corpus. */
  readonly description: string;
  /** Current lifecycle status. */
  readonly status: CorpusStatus;
  /** IDs of datasets included in this corpus. */
  readonly dataset_ids: readonly string[];
  /** IDs of benchmarks included in this corpus. */
  readonly benchmark_ids: readonly string[];
  /** Tags for categorization and search. */
  readonly tags: readonly string[];
  /** Version number (incremented on each new version). */
  readonly version: number;
  /** Arbitrary metadata key-value pairs. */
  readonly metadata: Record<string, unknown>;
  /** ISO-8601 timestamp when this corpus was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this corpus was last updated. */
  readonly updated_at: string;
}

/** Creates a new Corpus record. */
export function createCorpus(params: {
  readonly organization_id: OrganizationId;
  readonly project_id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly dataset_ids?: readonly string[];
  readonly benchmark_ids?: readonly string[];
  readonly tags?: readonly string[];
}): Corpus {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organization_id: params.organization_id,
    project_id: params.project_id,
    name: params.name,
    description: params.description,
    status: "draft",
    dataset_ids: params.dataset_ids ?? [],
    benchmark_ids: params.benchmark_ids ?? [],
    tags: params.tags ?? [],
    version: 1,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
}
