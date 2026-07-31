/**
 * D1-backed implementation of the ApiKeyRepository.
 *
 * Handles all persistence operations for API Key domain objects
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
 * Raw D1 row shape for API keys.
 */
interface ApiKeyRow {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly key_hash: string;
  readonly key_prefix: string;
  readonly permissions: string;
  readonly expires_at: string | null;
  readonly last_used_at: string | null;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

/**
 * Repository interface for API key persistence.
 */
export interface ApiKeyRepository {
  create(params: {
    readonly id: string;
    readonly project_id: string;
    readonly name: string;
    readonly key_hash: string;
    readonly key_prefix: string;
    readonly permissions: Record<string, unknown>;
    readonly expires_at: string | null;
  }): Promise<void>;
  findById(id: string): Promise<Record<string, unknown> | null>;
  findByKeyHash(keyHash: string): Promise<Record<string, unknown> | null>;
  listByProject(
    projectId: string,
    options: { cursor?: string; limit: number }
  ): Promise<PaginatedResult<Record<string, unknown>>>;
  updateLastUsed(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * D1 implementation of the API key repository.
 */
export class D1ApiKeyRepository implements ApiKeyRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "api_keys") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(params: {
    readonly id: string;
    readonly project_id: string;
    readonly name: string;
    readonly key_hash: string;
    readonly key_prefix: string;
    readonly permissions: Record<string, unknown>;
    readonly expires_at: string | null;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          project_id,
          name,
          key_hash,
          key_prefix,
          permissions,
          expires_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.project_id,
        params.name,
        params.key_hash,
        params.key_prefix,
        JSON.stringify(params.permissions),
        params.expires_at,
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
      .first<ApiKeyRow>();

    return result ? this.rowToApiKey(result) : null;
  }

  async findByKeyHash(keyHash: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE key_hash = ? AND deleted_at IS NULL`
      )
      .bind(keyHash)
      .first<ApiKeyRow>();

    return result ? this.rowToApiKey(result) : null;
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
      whereClause += " AND created_at > (SELECT created_at FROM api_keys WHERE id = ?)";
      params.push(cursor);
    }

    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC LIMIT ?`;

    const dataResult = await this.db
      .prepare(dataQuery)
      .bind(...params, queryLimit)
      .all<ApiKeyRow>();

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = items.map((row) => this.rowToApiKey(row));

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName}
         SET last_used_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(new Date().toISOString(), id)
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

  private rowToApiKey(row: ApiKeyRow): Record<string, unknown> {
    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      key_hash: row.key_hash,
      key_prefix: row.key_prefix,
      permissions: JSON.parse(row.permissions) as Record<string, unknown>,
      expires_at: row.expires_at,
      last_used_at: row.last_used_at,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    };
  }
}
