/**
 * Event type values as a string literal union.
 *
 * Events are the primary communication mechanism between services.
 * They are append-only and never mutated.
 */

/** All event types in the StratScope platform. */
export type EventType =
  | "execution_created"
  | "execution_accepted"
  | "execution_started"
  | "execution_completed"
  | "execution_failed"
  | "execution_cancelled"
  | "execution_archived"
  | "evaluation_generated"
  | "reflection_generated"
  | "knowledge_extracted"
  | "learning_generated"
  | "optimization_generated"
  | "recommendation_published";

/** Events related to execution lifecycle. */
export type ExecutionEventType =
  | "execution_created"
  | "execution_accepted"
  | "execution_started"
  | "execution_completed"
  | "execution_failed"
  | "execution_cancelled"
  | "execution_archived";

/** Events related to intelligence processing. */
export type IntelligenceEventType =
  | "evaluation_generated"
  | "reflection_generated"
  | "knowledge_extracted"
  | "learning_generated"
  | "optimization_generated"
  | "recommendation_published";

/** Maps event types to the services that emit them. */
export const EVENT_SOURCE_MAP: Record<EventType, string> = {
  execution_created: "execution-service",
  execution_accepted: "execution-service",
  execution_started: "execution-service",
  execution_completed: "execution-service",
  execution_failed: "execution-service",
  execution_cancelled: "execution-service",
  execution_archived: "execution-service",
  evaluation_generated: "evaluation-service",
  reflection_generated: "reflection-service",
  knowledge_extracted: "knowledge-service",
  learning_generated: "learning-service",
  optimization_generated: "optimization-service",
  recommendation_published: "recommendation-service",
};
