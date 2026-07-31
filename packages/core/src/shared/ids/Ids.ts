/**
 * All domain identifier types for the StratScope platform.
 *
 * Every domain object uses a branded string ID to prevent
 * accidental cross-type assignment at compile time.
 */

import type { Brand } from "./Brand";

/** Unique identifier for an organization (tenant). */
export type OrganizationId = Brand<"OrganizationId", string>;

/** Unique identifier for a project within an organization. */
export type ProjectId = Brand<"ProjectId", string>;

/** Unique identifier for an execution instance. */
export type ExecutionId = Brand<"ExecutionId", string>;

/** Unique identifier for an event. */
export type EventId = Brand<"EventId", string>;

/** Unique identifier for an artifact produced by a pipeline stage. */
export type ArtifactId = Brand<"ArtifactId", string>;

/** Unique identifier for an evaluation record. */
export type EvaluationId = Brand<"EvaluationId", string>;

/** Unique identifier for a reflection record. */
export type ReflectionId = Brand<"ReflectionId", string>;

/** Unique identifier for a knowledge node. */
export type KnowledgeNodeId = Brand<"KnowledgeNodeId", string>;

/** Unique identifier for a knowledge edge. */
export type KnowledgeEdgeId = Brand<"KnowledgeEdgeId", string>;

/** Unique identifier for a learning record. */
export type LearningRecordId = Brand<"LearningRecordId", string>;

/** Unique identifier for a recommendation. */
export type RecommendationId = Brand<"RecommendationId", string>;

/** Unique identifier for an AI agent. */
export type AgentId = Brand<"AgentId", string>;

/** Unique identifier for a user. */
export type UserId = Brand<"UserId", string>;

/** Unique identifier for an API key. */
export type ApiKeyId = Brand<"ApiKeyId", string>;

/** Unique identifier for a pipeline. */
export type PipelineId = Brand<"PipelineId", string>;

/** Unique identifier for a research dataset. */
export type DatasetId = Brand<"DatasetId", string>;

/** Unique identifier for a benchmark. */
export type BenchmarkId = Brand<"BenchmarkId", string>;

/** Unique identifier for a corpus. */
export type CorpusId = Brand<"CorpusId", string>;

/** Unique identifier for a dataset export. */
export type DatasetExportId = Brand<"DatasetExportId", string>;

/** Unique identifier for a dataset version. */
export type DatasetVersionId = Brand<"DatasetVersionId", string>;

/** Helper to create a branded ID from a raw string value. */
export function createId<T extends Brand<string, string>>(value: string): T {
  return value as T;
}
