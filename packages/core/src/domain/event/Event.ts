/**
 * Immutable event record.
 *
 * Events are the backbone of the event-sourced architecture.
 * They are append-only, never mutated, and carry all state transitions
 * across service boundaries.
 */

import type {
  EventId,
  ExecutionId,
  OrganizationId,
  ProjectId,
} from "../../shared/ids/Ids";
import type { EventType } from "./EventType";

/**
 * The canonical event record.
 */
export interface Event {
  /** Unique identifier for this event. */
  readonly event_id: EventId;
  /** Type of event. */
  readonly type: EventType;
  /** Organization this event belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this event belongs to. */
  readonly project_id: ProjectId;
  /** Execution this event relates to, if applicable. */
  readonly execution_id: ExecutionId | null;
  /** Monotonically increasing sequence number within the execution. */
  readonly sequence_number: number;
  /** ISO-8601 timestamp when this event was emitted. */
  readonly timestamp: string;
  /** The event payload - structure varies by event type. */
  readonly payload: Record<string, unknown>;
  /** Service that emitted this event. */
  readonly source_service: string;
  /** Correlation ID for linking related events across services. */
  readonly correlation_id: string;
  /** Optional metadata about the event. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Creates a new Event record.
 */
export function createEvent(overrides: {
  event_id: EventId;
  type: EventType;
  organization_id: OrganizationId;
  project_id: ProjectId;
  execution_id?: ExecutionId | null;
  sequence_number: number;
  payload: Record<string, unknown>;
  source_service: string;
  correlation_id: string;
  metadata?: Record<string, unknown>;
}): Event {
  return {
    event_id: overrides.event_id,
    type: overrides.type,
    organization_id: overrides.organization_id,
    project_id: overrides.project_id,
    execution_id: overrides.execution_id ?? null,
    sequence_number: overrides.sequence_number,
    timestamp: new Date().toISOString(),
    payload: overrides.payload,
    source_service: overrides.source_service,
    correlation_id: overrides.correlation_id,
    metadata: overrides.metadata,
  };
}
