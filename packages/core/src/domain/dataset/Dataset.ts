/**
 * Dataset — A versioned collection of execution intelligence records
 * curated for research, benchmarking, and model training.
 *
 * Datasets are immutable once created. New versions create new Dataset records.
 */

import type { OrganizationId, ProjectId } from "../../shared/ids/Ids";

/** The category of dataset. */
export type DatasetCategory =
  | "failure"
  | "reasoning"
  | "tool_selection"
  | "model_routing"
  | "prompt_improvement"
  | "reflection"
  | "evaluation"
  | "knowledge"
  | "coding"
  | "planning"
  | "research";

/** The status of a dataset. */
export type DatasetStatus = "building" | "validating" | "ready" | "archived";

/** Export format supported by the dataset. */
export type ExportFormat = "jsonl" | "parquet" | "csv" | "arrow" | "rest";

/** A research dataset. */
export interface Dataset {
  /** Unique identifier for this dataset. */
  readonly id: string;
  /** Organization this dataset belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this dataset belongs to. */
  readonly project_id: ProjectId;
  /** Human-readable name. */
  readonly name: string;
  /** Detailed description of the dataset. */
  readonly description: string;
  /** The category of data in this dataset. */
  readonly category: DatasetCategory;
  /** Current lifecycle status. */
  readonly status: DatasetStatus;
  /** Version number (incremented on each new version). */
  readonly version: number;
  /** ID of the parent dataset this was forked from, if any. */
  readonly parent_dataset_id: string | null;
  /** Number of records currently in the dataset. */
  readonly record_count: number;
  /** JSON schema definition for records in this dataset. */
  readonly schema_definition: Record<string, unknown>;
  /** Filters applied to derive this dataset from source data. */
  readonly filters: Record<string, unknown>;
  /** Tags for categorization and search. */
  readonly tags: readonly string[];
  /** Supported export formats. */
  readonly export_formats: readonly ExportFormat[];
  /** Storage path in R2 or external storage, null if not yet built. */
  readonly storage_path: string | null;
  /** SHA-256 checksum of the built dataset file, null if not yet built. */
  readonly checksum: string | null;
  /** Arbitrary metadata key-value pairs. */
  readonly metadata: Record<string, unknown>;
  /** ISO-8601 timestamp when this dataset was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this dataset was last updated. */
  readonly updated_at: string;
}

/** Creates a new Dataset record. */
export function createDataset(params: {
  readonly organization_id: OrganizationId;
  readonly project_id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly category: DatasetCategory;
  readonly version?: number;
  readonly parent_dataset_id?: string | null;
  readonly schema_definition?: Record<string, unknown>;
  readonly filters?: Record<string, unknown>;
  readonly tags?: readonly string[];
  readonly export_formats?: readonly ExportFormat[];
  readonly metadata?: Record<string, unknown>;
}): Dataset {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organization_id: params.organization_id,
    project_id: params.project_id,
    name: params.name,
    description: params.description,
    category: params.category,
    status: "building",
    version: params.version ?? 1,
    parent_dataset_id: params.parent_dataset_id ?? null,
    record_count: 0,
    schema_definition: params.schema_definition ?? {},
    filters: params.filters ?? {},
    tags: params.tags ?? [],
    export_formats: params.export_formats ?? ["jsonl", "csv"],
    storage_path: null,
    checksum: null,
    metadata: params.metadata ?? {},
    created_at: now,
    updated_at: now,
  };
}
