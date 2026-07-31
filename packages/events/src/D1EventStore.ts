import type { D1Database } from '@cloudflare/workers-types';
import type {
  ExecutionId,
  OrganizationId,
} from '@stratscope/core';
import type {
  DomainEvent,
  EventType,
  PaginatedResult,
  PaginationOptions,
} from './EventTypes';
import type { EventStore } from './EventStore';

interface D1EventRow {
  readonly event_id: string;
  readonly event_type: string;
  readonly execution_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly timestamp: string;
  readonly schema_version: string;
  readonly producer: string;
  readonly payload: string;
  readonly metadata: string;
}

interface D1EventStoreConfig {
  readonly db: D1Database;
  readonly tableName?: string;
}

export class D1EventStore implements EventStore {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(config: D1EventStoreConfig) {
    this.db = config.db;
    this.tableName = config.tableName ?? 'events';
  }

  async append(event: DomainEvent): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          event_id,
          event_type,
          execution_id,
          organization_id,
          project_id,
          timestamp,
          schema_version,
          producer,
          payload,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.event_id,
        event.event_type,
        event.execution_id,
        event.organization_id,
        event.project_id,
        event.timestamp,
        event.schema_version,
        event.producer,
        JSON.stringify(event.payload),
        JSON.stringify(event.metadata)
      )
      .run();
  }

  async appendBatch(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const statements = events.map((event) =>
      this.db
        .prepare(
          `INSERT INTO ${this.tableName} (
            event_id,
            event_type,
            execution_id,
            organization_id,
            project_id,
            timestamp,
            schema_version,
            producer,
            payload,
            metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          event.event_id,
          event.event_type,
          event.execution_id,
          event.organization_id,
          event.project_id,
          event.timestamp,
          event.schema_version,
          event.producer,
          JSON.stringify(event.payload),
          JSON.stringify(event.metadata)
        )
    );

    await this.db.batch(statements);
  }

  async getByExecutionId(executionId: ExecutionId): Promise<DomainEvent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE execution_id = ?
         ORDER BY timestamp ASC`
      )
      .bind(executionId)
      .all<D1EventRow>();

    return result.results.map((row) => this.rowToDomainEvent(row));
  }

  async getByOrganizationId(
    organizationId: OrganizationId,
    options: PaginationOptions
  ): Promise<PaginatedResult<DomainEvent>> {
    const { cursor, limit, direction = 'forward' } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);
    const isForward = direction === 'forward';

    let query = `SELECT * FROM ${this.tableName} WHERE organization_id = ?`;
    const params: unknown[] = [organizationId];

    if (cursor) {
      if (isForward) {
        query += ` AND timestamp > (SELECT timestamp FROM ${this.tableName} WHERE event_id = ?)`;
      } else {
        query += ` AND timestamp < (SELECT timestamp FROM ${this.tableName} WHERE event_id = ?)`;
      }
      params.push(cursor);
    }

    query += isForward
      ? ` ORDER BY timestamp ASC LIMIT ?`
      : ` ORDER BY timestamp DESC LIMIT ?`;

    params.push(normalizedLimit + 1);

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<D1EventRow>();

    const rows = result.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = isForward
      ? items.map((row) => this.rowToDomainEvent(row))
      : items.map((row) => this.rowToDomainEvent(row)).reverse();

    const nextCursor = hasMore && items.length > 0
      ? (items[items.length - 1] as D1EventRow).event_id
      : null;

    const countResult = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ${this.tableName} WHERE organization_id = ?`
      )
      .bind(organizationId)
      .first<{ readonly total: number }>();

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: countResult?.total ?? 0,
    };
  }

  async getByType(
    eventType: EventType,
    options: PaginationOptions
  ): Promise<PaginatedResult<DomainEvent>> {
    const { cursor, limit, direction = 'forward' } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);
    const isForward = direction === 'forward';

    let query = `SELECT * FROM ${this.tableName} WHERE event_type = ?`;
    const params: unknown[] = [eventType];

    if (cursor) {
      if (isForward) {
        query += ` AND timestamp > (SELECT timestamp FROM ${this.tableName} WHERE event_id = ?)`;
      } else {
        query += ` AND timestamp < (SELECT timestamp FROM ${this.tableName} WHERE event_id = ?)`;
      }
      params.push(cursor);
    }

    query += isForward
      ? ` ORDER BY timestamp ASC LIMIT ?`
      : ` ORDER BY timestamp DESC LIMIT ?`;

    params.push(normalizedLimit + 1);

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<D1EventRow>();

    const rows = result.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = isForward
      ? items.map((row) => this.rowToDomainEvent(row))
      : items.map((row) => this.rowToDomainEvent(row)).reverse();

    const nextCursor = hasMore && items.length > 0
      ? (items[items.length - 1] as D1EventRow).event_id
      : null;

    const countResult = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ${this.tableName} WHERE event_type = ?`
      )
      .bind(eventType)
      .first<{ readonly total: number }>();

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: countResult?.total ?? 0,
    };
  }

  private rowToDomainEvent(row: D1EventRow): DomainEvent {
    return {
      event_id: row.event_id as DomainEvent['event_id'],
      event_type: row.event_type as EventType,
      execution_id: row.execution_id as DomainEvent['execution_id'],
      organization_id: row.organization_id as DomainEvent['organization_id'],
      project_id: row.project_id as DomainEvent['project_id'],
      timestamp: row.timestamp,
      schema_version: row.schema_version,
      producer: row.producer,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    };
  }
}
