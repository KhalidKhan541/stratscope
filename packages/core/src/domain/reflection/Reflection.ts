/**
 * Reflection record - structured reasoning about execution quality.
 *
 * Reflections analyze evaluations and identify patterns, root causes,
 * and actionable insights. They bridge raw metrics and knowledge extraction.
 */

import type {
  ReflectionId,
  ExecutionId,
  EvaluationId,
  OrganizationId,
  ProjectId,
} from "../../shared/ids/Ids";

/** The type of reflection performed. */
export type ReflectionType =
  | "root_cause_analysis"
  | "pattern_recognition"
  | "anomaly_detection"
  | "trend_analysis"
  | "comparative_analysis";

/** Confidence level of the reflection. */
export type ReflectionConfidence = "low" | "medium" | "high" | "very_high";

/** The canonical reflection record. */
export interface Reflection {
  /** Unique identifier for this reflection. */
  readonly reflection_id: ReflectionId;
  /** Execution this reflection analyzes. */
  readonly execution_id: ExecutionId;
  /** Evaluation that triggered this reflection. */
  readonly evaluation_id: EvaluationId;
  /** Organization this reflection belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this reflection belongs to. */
  readonly project_id: ProjectId;
  /** Type of reflection performed. */
  readonly reflection_type: ReflectionType;
  /** Structured insights from the reflection. */
  readonly insights: ReadonlyArray<ReflectionInsight>;
  /** Overall confidence in the reflection. */
  readonly confidence: ReflectionConfidence;
  /** Summary of the reflection findings. */
  readonly summary: string;
  /** ISO-8601 timestamp when this reflection was generated. */
  readonly created_at: string;
  /** Version of the reflection model used. */
  readonly reflection_model_version: string;
  /** Execution IDs that were compared, if this is a comparative analysis. */
  readonly compared_execution_ids?: ReadonlyArray<string>;
}

/** A single insight from a reflection. */
export interface ReflectionInsight {
  /** Unique identifier for this insight. */
  readonly insight_id: string;
  /** Category of insight (e.g., "latency", "cost", "quality"). */
  readonly category: string;
  /** Human-readable description of the insight. */
  readonly description: string;
  /** Confidence in this specific insight. */
  readonly confidence: ReflectionConfidence;
  /** Supporting evidence or data for this insight. */
  readonly evidence: Record<string, unknown>;
  /** Whether this insight is actionable. */
  readonly actionable: boolean;
  /** Optional recommended action. */
  readonly recommended_action?: string;
}

/**
 * Creates a new Reflection record.
 */
export function createReflection(overrides: {
  reflection_id: ReflectionId;
  execution_id: ExecutionId;
  evaluation_id: EvaluationId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  reflection_type: ReflectionType;
  insights: ReadonlyArray<ReflectionInsight>;
  confidence: ReflectionConfidence;
  summary: string;
  reflection_model_version: string;
  compared_execution_ids?: ReadonlyArray<string>;
}): Reflection {
  return {
    reflection_id: overrides.reflection_id,
    execution_id: overrides.execution_id,
    evaluation_id: overrides.evaluation_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    reflection_type: overrides.reflection_type,
    insights: overrides.insights,
    confidence: overrides.confidence,
    summary: overrides.summary,
    created_at: new Date().toISOString(),
    reflection_model_version: overrides.reflection_model_version,
    compared_execution_ids: overrides.compared_execution_ids,
  };
}
