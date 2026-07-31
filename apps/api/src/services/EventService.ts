interface IEventService {
  publishEvent(params: {
    readonly event_type: string;
    readonly execution_id: string;
    readonly organization_id: string;
    readonly project_id: string;
    readonly payload: Record<string, unknown>;
    readonly metadata?: Record<string, unknown>;
  }): Promise<{ readonly event_id: string }>;
  listByExecution(executionId: string, options: { cursor?: string; limit: number }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }>;
  listByOrganization(organizationId: string, options: { cursor?: string; limit: number; event_type?: string }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }>;
}

export class EventService implements IEventService {
  constructor(private readonly db: D1Database) {}

  async publishEvent(params: {
    readonly event_type: string;
    readonly execution_id: string;
    readonly organization_id: string;
    readonly project_id: string;
    readonly payload: Record<string, unknown>;
    readonly metadata?: Record<string, unknown>;
  }) {
    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO events (id, execution_id, event_type, service, payload, metadata, timestamp, schema_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId,
      params.execution_id,
      params.event_type,
      "api",
      JSON.stringify(params.payload),
      JSON.stringify(params.metadata ?? {}),
      now,
      "1.0.0"
    ).run();

    return { event_id: eventId };
  }

  async listByExecution(executionId: string, options: { cursor?: string; limit: number }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }> {
    const limit = Math.min(Math.max(options.limit, 1), 100);
    const query = options.cursor
      ? `SELECT * FROM events WHERE execution_id = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM events WHERE execution_id = ? ORDER BY timestamp DESC LIMIT ?`;
    const params = options.cursor
      ? [executionId, options.cursor, limit + 1]
      : [executionId, limit + 1];

    const rows = await this.db.prepare(query).bind(...params).all();
    const items = rows.results ?? [];
    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;

    return {
      items: Object.freeze(sliced),
      next_cursor: hasMore && sliced.length > 0 ? (sliced[sliced.length - 1] as Record<string, unknown>)["timestamp"] as string : null,
      has_more: hasMore,
    };
  }

  async listByOrganization(organizationId: string, options: { cursor?: string; limit: number; event_type?: string }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }> {
    const limit = Math.min(Math.max(options.limit, 1), 100);
    let query: string;
    let params: unknown[];

    if (options.event_type) {
      query = options.cursor
        ? `SELECT * FROM events e JOIN executions ex ON e.execution_id = ex.id WHERE ex.organization_id = ? AND e.event_type = ? AND e.timestamp < ? ORDER BY e.timestamp DESC LIMIT ?`
        : `SELECT * FROM events e JOIN executions ex ON e.execution_id = ex.id WHERE ex.organization_id = ? AND e.event_type = ? ORDER BY e.timestamp DESC LIMIT ?`;
      params = options.cursor
        ? [organizationId, options.event_type, options.cursor, limit + 1]
        : [organizationId, options.event_type, limit + 1];
    } else {
      query = options.cursor
        ? `SELECT * FROM events e JOIN executions ex ON e.execution_id = ex.id WHERE ex.organization_id = ? AND e.timestamp < ? ORDER BY e.timestamp DESC LIMIT ?`
        : `SELECT * FROM events e JOIN executions ex ON e.execution_id = ex.id WHERE ex.organization_id = ? ORDER BY e.timestamp DESC LIMIT ?`;
      params = options.cursor
        ? [organizationId, options.cursor, limit + 1]
        : [organizationId, limit + 1];
    }

    const rows = await this.db.prepare(query).bind(...params).all();
    const items = rows.results ?? [];
    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;

    return {
      items: Object.freeze(sliced),
      next_cursor: hasMore && sliced.length > 0 ? (sliced[sliced.length - 1] as Record<string, unknown>)["timestamp"] as string : null,
      has_more: hasMore,
    };
  }
}
