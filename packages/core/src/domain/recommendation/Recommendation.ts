/**
 * Recommendation record - optimization suggestions derived from learnings.
 *
 * Recommendations are the final output of the intelligence pipeline.
 * They provide actionable suggestions to improve AI execution performance.
 */

import type {
  RecommendationId,
  OrganizationId,
  ProjectId,
  LearningRecordId,
  ExecutionId,
} from "../../shared/ids/Ids";

/** The category of recommendation. */
export type RecommendationCategory =
  | "model_selection"
  | "prompt_optimization"
  | "parameter_tuning"
  | "cost_reduction"
  | "latency_improvement"
  | "quality_improvement"
  | "safety_enhancement"
  | "architecture_change";

/** Priority level of the recommendation. */
export type RecommendationPriority = "low" | "medium" | "high" | "urgent";

/** Implementation status of the recommendation. */
export type RecommendationStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "implemented"
  | "rejected"
  | "superseded";

/** The canonical recommendation record. */
export interface Recommendation {
  /** Unique identifier for this recommendation. */
  readonly recommendation_id: RecommendationId;
  /** Organization this recommendation belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this recommendation belongs to. */
  readonly project_id: ProjectId;
  /** Category of recommendation. */
  readonly category: RecommendationCategory;
  /** Priority level. */
  readonly priority: RecommendationPriority;
  /** Current implementation status. */
  readonly status: RecommendationStatus;
  /** Human-readable title. */
  readonly title: string;
  /** Detailed description of the recommendation. */
  readonly description: string;
  /** Concrete steps to implement this recommendation. */
  readonly implementation_steps: ReadonlyArray<string>;
  /** Expected impact metrics after implementation. */
  readonly expected_impact: RecommendationImpact;
  /** Learning records that led to this recommendation. */
  readonly source_learning_ids: ReadonlyArray<LearningRecordId>;
  /** Execution IDs that demonstrate the need for this recommendation. */
  readonly source_execution_ids: ReadonlyArray<ExecutionId>;
  /** Confidence in this recommendation (0.0 to 1.0). */
  readonly confidence: number;
  /** Estimated cost savings in USD, if applicable. */
  readonly estimated_cost_savings_usd?: number;
  /** Estimated latency improvement in milliseconds, if applicable. */
  readonly estimated_latency_improvement_ms?: number;
  /** ISO-8601 timestamp when this recommendation was generated. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this recommendation expires. */
  readonly expires_at?: string;
  /** ISO-8601 timestamp when this recommendation was last reviewed. */
  readonly last_reviewed_at?: string;
  /** Version of the optimization model used. */
  readonly optimization_model_version: string;
}

/** Expected impact metrics for a recommendation. */
export interface RecommendationImpact {
  /** Expected quality improvement (0.0 to 1.0). */
  readonly quality_delta?: number;
  /** Expected latency reduction in milliseconds. */
  readonly latency_delta_ms?: number;
  /** Expected cost reduction in USD. */
  readonly cost_delta_usd?: number;
  /** Expected token efficiency improvement. */
  readonly token_efficiency_delta?: number;
  /** Human-readable summary of expected impact. */
  readonly summary: string;
}

/**
 * Creates a new Recommendation record.
 */
export function createRecommendation(overrides: {
  recommendation_id: RecommendationId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  implementation_steps: ReadonlyArray<string>;
  expected_impact: RecommendationImpact;
  source_learning_ids?: ReadonlyArray<LearningRecordId>;
  source_execution_ids?: ReadonlyArray<ExecutionId>;
  confidence?: number;
  estimated_cost_savings_usd?: number;
  estimated_latency_improvement_ms?: number;
  optimization_model_version: string;
}): Recommendation {
  return {
    recommendation_id: overrides.recommendation_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    category: overrides.category,
    priority: overrides.priority,
    status: "pending",
    title: overrides.title,
    description: overrides.description,
    implementation_steps: overrides.implementation_steps,
    expected_impact: overrides.expected_impact,
    source_learning_ids: overrides.source_learning_ids ?? [],
    source_execution_ids: overrides.source_execution_ids ?? [],
    confidence: overrides.confidence ?? 0.5,
    estimated_cost_savings_usd: overrides.estimated_cost_savings_usd,
    estimated_latency_improvement_ms: overrides.estimated_latency_improvement_ms,
    created_at: new Date().toISOString(),
    optimization_model_version: overrides.optimization_model_version,
  };
}
