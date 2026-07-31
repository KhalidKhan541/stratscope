/**
 * Learning record - captures detected patterns from execution history.
 *
 * Learning records represent the output of the learning engine.
 * They identify recurring patterns, anomalies, and optimization opportunities.
 */

import type {
  LearningRecordId,
  OrganizationId,
  ProjectId,
  ExecutionId,
} from "../../shared/ids/Ids";

/** The type of learning detected. */
export type LearningType =
  | "pattern_detected"
  | "anomaly_detected"
  | "trend_identified"
  | "optimization_opportunity"
  | "regression_detected"
  | "improvement_detected";

/** The severity or impact level of the learning. */
export type LearningSeverity = "low" | "medium" | "high" | "critical";

/** The canonical learning record. */
export interface LearningRecord {
  /** Unique identifier for this learning record. */
  readonly learning_id: LearningRecordId;
  /** Organization this learning belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this learning belongs to. */
  readonly project_id: ProjectId;
  /** Type of learning detected. */
  readonly learning_type: LearningType;
  /** Human-readable title for this learning. */
  readonly title: string;
  /** Detailed description of the pattern or insight. */
  readonly description: string;
  /** Structured data about the detected pattern. */
  readonly pattern_data: Record<string, unknown>;
  /** Execution IDs that contributed to this learning. */
  readonly source_execution_ids: ReadonlyArray<ExecutionId>;
  /** Number of executions that exhibit this pattern. */
  readonly occurrence_count: number;
  /** Severity or impact of this learning. */
  readonly severity: LearningSeverity;
  /** Confidence in this learning (0.0 to 1.0). */
  readonly confidence: number;
  /** Whether this learning has been acted upon. */
  readonly actionable: boolean;
  /** Optional recommended action based on this learning. */
  readonly recommended_action?: string;
  /** ISO-8601 timestamp when this learning was generated. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this learning was last reviewed. */
  readonly last_reviewed_at?: string;
  /** Version of the learning model used. */
  readonly learning_model_version: string;
}

/**
 * Creates a new LearningRecord.
 */
export function createLearningRecord(overrides: {
  learning_id: LearningRecordId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  learning_type: LearningType;
  title: string;
  description: string;
  pattern_data?: Record<string, unknown>;
  source_execution_ids?: ReadonlyArray<ExecutionId>;
  occurrence_count?: number;
  severity?: LearningSeverity;
  confidence?: number;
  actionable?: boolean;
  recommended_action?: string;
  learning_model_version: string;
}): LearningRecord {
  return {
    learning_id: overrides.learning_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    learning_type: overrides.learning_type,
    title: overrides.title,
    description: overrides.description,
    pattern_data: overrides.pattern_data ?? {},
    source_execution_ids: overrides.source_execution_ids ?? [],
    occurrence_count: overrides.occurrence_count ?? 1,
    severity: overrides.severity ?? "medium",
    confidence: overrides.confidence ?? 0.5,
    actionable: overrides.actionable ?? true,
    recommended_action: overrides.recommended_action,
    created_at: new Date().toISOString(),
    learning_model_version: overrides.learning_model_version,
  };
}
