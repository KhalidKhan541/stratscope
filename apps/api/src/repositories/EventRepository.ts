/**
 * Event data access interface.
 *
 * Defines the contract for all event persistence operations.
 * Events are append-only and immutable.
 */

export interface EventRecord {
  readonly id: string;
  readonly execution_id: string;
  readonly event_type: string;
  readonly service: string | null;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
  readonly schema_version: string;
}

export type EventType =
  | "execution.created"
  | "execution.accepted"
  | "execution.started"
  | "execution.completed"
  | "execution.failed"
  | "execution.cancelled"
  | "execution.archived"
  | "evaluation.generated"
  | "reflection.generated"
  | "knowledge.extracted"
  | "learning.generated"
  | "optimization.generated"
  | "recommendation.published";

export interface EventListFilters {
  readonly executionId?: string;
  readonly eventType?: EventType;
  readonly organizationId?: string;
}

export interface PaginationParams {
  readonly cursor?: string;
  readonly limit: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface CreateEventData {
  readonly id: string;
  readonly executionId: string;
  readonly eventType: EventType;
  readonly service?: string;
  readonly payload?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp?: string;
  readonly schemaVersion?: string;
}

/**
 * Repository interface for event data access.
 */
export interface EventRepository {
  /**
   * Appends a new event to the event store.
   */
  append(data: CreateEventData): Promise<EventRecord>;

  /**
   * Appends multiple events in a single transaction.
   */
  appendBatch(events: CreateEventData[]): Promise<EventRecord[]>;

  /**
   * Retrieves an event by ID.
   */
  getById(id: string): Promise<EventRecord | null>;

  /**
   * Lists events for a specific execution.
   */
  listByExecutionId(
    executionId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<EventRecord>>;

  /**
   * Lists events with filtering and pagination.
   */
  list(
    filters: EventListFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<EventRecord>>;

  /**
   * Counts events by type for an execution.
   */
  countByExecutionAndType(executionId: string, eventType: EventType): Promise<number>;

  /**
   * Gets the most recent event for an execution.
   */
  getLatestByExecutionId(executionId: string): Promise<EventRecord | null>;
}
