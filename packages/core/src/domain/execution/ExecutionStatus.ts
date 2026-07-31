/**
 * Execution status values as a string literal union.
 *
 * Follows the Execution Specification (EXS) lifecycle:
 * created -> accepted -> normalized -> evaluated -> reflected ->
 * knowledge extracted -> learned -> optimized -> recommendation published -> archived
 */

/** Status of an execution in the pipeline lifecycle. */
export type ExecutionStatus =
  | "created"
  | "accepted"
  | "normalized"
  | "evaluated"
  | "reflected"
  | "knowledge_extracted"
  | "learned"
  | "optimized"
  | "recommendation_published"
  | "completed"
  | "archived"
  | "failed"
  | "cancelled";

/** Statuses that represent a terminal state (no further transitions). */
export type TerminalExecutionStatus = "completed" | "archived" | "failed" | "cancelled";

/** Statuses that represent an active/pending state. */
export type ActiveExecutionStatus =
  | "created"
  | "accepted"
  | "normalized"
  | "evaluated"
  | "reflected"
  | "knowledge_extracted"
  | "learned"
  | "optimized"
  | "recommendation_published";

/**
 * Checks whether a status is terminal.
 */
export function isTerminalStatus(status: ExecutionStatus): status is TerminalExecutionStatus {
  return status === "archived" || status === "failed" || status === "cancelled";
}

/**
 * Returns the next status in the canonical lifecycle, or null if terminal.
 */
export function nextStatus(current: ExecutionStatus): ExecutionStatus | null {
  const transitions: Record<ExecutionStatus, ExecutionStatus | null> = {
    created: "accepted",
    accepted: "normalized",
    normalized: "evaluated",
    evaluated: "reflected",
    reflected: "knowledge_extracted",
    knowledge_extracted: "learned",
    learned: "optimized",
    optimized: "recommendation_published",
    recommendation_published: "completed",
    completed: "archived",
    archived: null,
    failed: null,
    cancelled: null,
  };
  return transitions[current];
}
