/**
 * The atomic unit of the StratScope platform.
 *
 * Every AI interaction is captured as an Execution. This is the foundational
 * record from which all intelligence is derived. Follows the Execution
 * Specification (EXS) from the platform documentation.
 *
 * Executions are immutable once created. Status transitions are recorded
 * as events, not mutations.
 */

import type {
  ExecutionId,
  OrganizationId,
  ProjectId,
  AgentId,
} from "../../shared/ids/Ids";
import type { ExecutionStatus } from "./ExecutionStatus";

/**
 * The canonical execution record.
 *
 * This is the core domain object that every other subsystem consumes.
 * All fields are readonly to enforce immutability.
 */
export interface Execution {
  /** Unique identifier for this execution. */
  readonly execution_id: ExecutionId;
  /** Organization this execution belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this execution belongs to. */
  readonly project_id: ProjectId;
  /** AI agent that produced this execution, if applicable. */
  readonly agent_id: AgentId | null;
  /** Current status in the execution lifecycle. */
  readonly status: ExecutionStatus;
  /** Model used for this execution (e.g., "llama-3.3-70b-versatile"). */
  readonly model: string;
  /** Provider that served this execution (e.g., "groq"). */
  readonly provider: string;
  /** Distributed trace ID for request correlation across services. */
  readonly trace_id: string;
  /** Parent execution ID for chained or nested executions. */
  readonly parent_execution_id: ExecutionId | null;
  /** Version of the pipeline that processed this execution. */
  readonly pipeline_version: string;
  /** Version of the SDK that submitted this execution. */
  readonly sdk_version: string;
  /** ISO-8601 timestamp when execution processing started. */
  readonly started_at: string | null;
  /** ISO-8601 timestamp when execution processing completed. */
  readonly completed_at: string | null;
  /** Total latency in milliseconds from start to completion. */
  readonly latency_ms: number | null;
  /** Time spent waiting in queue before processing, in milliseconds. */
  readonly queue_latency_ms: number | null;
  /** Time spent in active processing, in milliseconds. */
  readonly processing_latency_ms: number | null;
  /** Number of tokens consumed as input. */
  readonly input_tokens: number;
  /** Number of tokens generated as output. */
  readonly output_tokens: number;
  /** Total tokens (input + output). */
  readonly total_tokens: number;
  /** Estimated cost in USD. */
  readonly estimated_cost: number;
  /** Additional metadata about this execution. */
  readonly metadata: Record<string, unknown>;
  /** Error information if the execution failed. */
  readonly error: Record<string, unknown> | null;
  /** ISO-8601 timestamp when this record was created. */
  readonly created_at: string;
}

/**
 * Creates a new Execution with sensible defaults.
 */
export function createExecution(overrides: {
  execution_id: ExecutionId;
  organization_id: OrganizationId;
  project_id: ProjectId;
  model: string;
  provider: string;
  trace_id: string;
  pipeline_version: string;
  sdk_version: string;
  agent_id?: AgentId | null;
  parent_execution_id?: ExecutionId | null;
  metadata?: Record<string, unknown>;
}): Execution {
  const now = new Date().toISOString();
  return {
    execution_id: overrides.execution_id,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    agent_id: overrides.agent_id ?? null,
    status: "created",
    model: overrides.model,
    provider: overrides.provider,
    trace_id: overrides.trace_id,
    parent_execution_id: overrides.parent_execution_id ?? null,
    pipeline_version: overrides.pipeline_version,
    sdk_version: overrides.sdk_version,
    started_at: null,
    completed_at: null,
    latency_ms: null,
    queue_latency_ms: null,
    processing_latency_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost: 0,
    metadata: overrides.metadata ?? {},
    error: null,
    created_at: now,
  };
}
