/**
 * Evaluation record - measures execution quality.
 *
 * Evaluations assess how well an execution performed across multiple
 * dimensions: relevance, accuracy, latency, cost efficiency, etc.
 */

import type {
  EvaluationId,
  ExecutionId,
  OrganizationId,
  ProjectId,
} from "../../shared/ids/Ids";

/** Quality dimension measured by an evaluation. */
export type EvaluationDimension =
  | "relevance"
  | "accuracy"
  | "coherence"
  | "completeness"
  | "conciseness"
  | "safety"
  | "latency"
  | "cost_efficiency"
  | "token_efficiency";

/** The canonical evaluation record. */
export interface Evaluation {
  /** Unique identifier for this evaluation. */
  readonly evaluation_id: EvaluationId;
  /** Execution this evaluation assesses. */
  readonly execution_id: ExecutionId;
  /** Organization this evaluation belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this evaluation belongs to. */
  readonly project_id: ProjectId;
  /** Evaluation dimensions and their scores. */
  readonly scores: ReadonlyArray<EvaluationScore>;
  /** Overall quality score (0.0 to 1.0). */
  readonly overall_score: number;
  /** ISO-8601 timestamp when this evaluation was generated. */
  readonly created_at: string;
  /** Version of the evaluation model or rules used. */
  readonly evaluation_model_version: string;
  /** Optional human-readable summary of the evaluation. */
  readonly summary?: string;
  /** Optional detailed notes from the evaluator. */
  readonly notes?: string;
  /** Whether this evaluation was generated automatically or by a human. */
  readonly source: "automated" | "human" | "hybrid";
}

/** A score for a single evaluation dimension. */
export interface EvaluationScore {
  /** The dimension being measured. */
  readonly dimension: EvaluationDimension;
  /** Numeric score (0.0 to 1.0). */
  readonly score: number;
  /** Optional explanation for this score. */
  readonly explanation?: string;
  /** Confidence in this score (0.0 to 1.0). */
  readonly confidence: number;
}

/**
 * Creates a new Evaluation record.
 */
export function createEvaluation(overrides: {
  evaluation_id: EvaluationId;
  execution_id: ExecutionId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  scores: ReadonlyArray<EvaluationScore>;
  overall_score: number;
  evaluation_model_version: string;
  summary?: string;
  notes?: string;
  source: "automated" | "human" | "hybrid";
}): Evaluation {
  return {
    evaluation_id: overrides.evaluation_id,
    execution_id: overrides.execution_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    scores: overrides.scores,
    overall_score: overrides.overall_score,
    created_at: new Date().toISOString(),
    evaluation_model_version: overrides.evaluation_model_version,
    summary: overrides.summary,
    notes: overrides.notes,
    source: overrides.source,
  };
}
