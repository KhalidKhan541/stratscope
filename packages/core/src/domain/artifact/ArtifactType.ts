/**
 * Artifact type values as a string literal union.
 *
 * Artifacts are immutable outputs produced by pipeline stages.
 * Each type represents a distinct form of execution intelligence.
 */

/** The type of artifact produced by a pipeline stage. */
export type ArtifactType =
  | "raw_input"
  | "raw_output"
  | "normalized_input"
  | "normalized_output"
  | "evaluation_report"
  | "reflection_report"
  | "knowledge_extraction"
  | "learning_record"
  | "optimization_report"
  | "recommendation"
  | "dataset"
  | "benchmark"
  | "corpus";

/** Maps artifact types to the pipeline stage that produces them. */
export const ARTIFACT_STAGE_MAP: Record<ArtifactType, string> = {
  raw_input: "ingestion",
  raw_output: "ingestion",
  normalized_input: "normalization",
  normalized_output: "normalization",
  evaluation_report: "evaluation",
  reflection_report: "reflection",
  knowledge_extraction: "knowledge",
  learning_record: "learning",
  optimization_report: "optimization",
  recommendation: "recommendation",
  dataset: "dataset",
  benchmark: "benchmark",
  corpus: "corpus",
};
