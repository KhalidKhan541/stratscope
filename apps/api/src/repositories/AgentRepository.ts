/**
 * D1-backed implementation of the AgentRepository.
 *
 * Handles all persistence operations for Agent domain objects
 * using Cloudflare D1 with parameterized queries.
 */

import type { D1Database } from "@cloudflare/workers-types";

/**
 * Paginated result set.
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
}

/**
 * Raw D1 row shape for agents.
 */
interface AgentRow {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly description: string;
  readonly framework: string;
  readonly provider: string;
  readonly model: string;
  readonly version: string;
  readonly config: string;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

/**
 * Repository interface for agent persistence.
 */
export interface AgentRepository {
  create(params: {
    readonly id: string;
    readonly project_id: string;
    readonly name: string;
    readonly description: string;
    readonly framework: string;
    readonly provider: string;
    readonly model: string;
    readonly version: string;
    readonly config: Record<string, unknown>;
  }): Promise<void>;
  findById(id: string): Promise<Record<string, unknown> | null>;
  listByProject(
    projectId: string,
    options: { cursor?: string; limit: number }
  ): Promise<PaginatedResult<Record<string, unknown>>>;
  update(id: string, params: { name?: string; description?: string; model?: string; config?: Record<string, unknown> }): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * D1 implementation of the agent repository.
 */
export class D1AgentRepository implements AgentRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "agents") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(params: {
    readonly id: string;
    readonly project_id: string;
    readonly name: string;
    readonly description: string;
    readonly framework: string;
    readonly provider: string;
    readonly model: string;
    readonly version: string;
    readonly config: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          project_id,
          name,
          description,
          framework,
          provider,
          model,
          version,
          config,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.project_id,
        params.name,
        params.description,
        params.framework,
        params.provider,
        params.model,
        params.version,
        JSON.stringify(params.config),
        new Date().toISOString()
      )
      .run();
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(id)
      .first<AgentRow>();

    return result ? this.rowToAgent(result) : null;
  }

  async listByProject(
    projectId: string,
    options: { cursor?: string; limit: number }
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { cursor, limit } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);

    let whereClause = "WHERE project_id = ? AND deleted_at IS NULL";
    const params: unknown[] = [projectId];

    if (cursor) {
      whereClause += " AND created_at > (SELECT created_at FROM agents WHERE id = ?)";
      params.push(cursor);
    }

    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC LIMIT ?`;

    const dataResult = await this.db
      .prepare(dataQuery)
      .bind(...params, queryLimit)
      .all<AgentRow>();

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = items.map((row) => this.rowToAgent(row));

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async update(id: string, params: { name?: string; description?: string; model?: string; config?: Record<string, unknown> }): Promise<void> {
    const setClauses: string[] = [];
    const bindParams: unknown[] = [];

    if (params.name !== undefined) {
      setClauses.push("name = ?");
      bindParams.push(params.name);
    }

    if (params.description !== undefined) {
      setClauses.push("description = ?");
      bindParams.push(params.description);
    }

    if (params.model !== undefined) {
      setClauses.push("model = ?");
      bindParams.push(params.model);
    }

    if (params.config !== undefined) {
      setClauses.push("config = ?");
      bindParams.push(JSON.stringify(params.config));
    }

    if (setClauses.length === 0) {
      return;
    }

    bindParams.push(id);

    await this.db
      .prepare(
        `UPDATE ${this.tableName}
         SET ${setClauses.join(", ")}
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(...bindParams)
      .run();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName}
         SET deleted_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  private rowToAgent(row: AgentRow): Record<string, unknown> {
    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      framework: row.framework,
      provider: row.provider,
      model: row.model,
      version: row.version,
      config: JSON.parse(row.config) as Record<string, unknown>,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    };
  }
}
