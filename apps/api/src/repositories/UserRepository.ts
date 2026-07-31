/**
 * D1-backed implementation of the UserRepository.
 *
 * Handles all persistence operations for User domain objects
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
 * Raw D1 row shape for users.
 */
interface UserRow {
  readonly id: string;
  readonly organization_id: string;
  readonly clerk_user_id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly status: string;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

/**
 * Repository interface for user persistence.
 */
export interface UserRepository {
  create(params: {
    readonly id: string;
    readonly organization_id: string;
    readonly clerk_user_id: string;
    readonly email: string;
    readonly name: string;
    readonly role: string;
  }): Promise<void>;
  findById(id: string): Promise<Record<string, unknown> | null>;
  findByClerkId(clerkUserId: string): Promise<Record<string, unknown> | null>;
  listByOrganization(
    organizationId: string,
    options: { cursor?: string; limit: number }
  ): Promise<PaginatedResult<Record<string, unknown>>>;
  update(id: string, params: { name?: string; role?: string; status?: string }): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * D1 implementation of the user repository.
 */
export class D1UserRepository implements UserRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "users") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(params: {
    readonly id: string;
    readonly organization_id: string;
    readonly clerk_user_id: string;
    readonly email: string;
    readonly name: string;
    readonly role: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          organization_id,
          clerk_user_id,
          email,
          name,
          role,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.organization_id,
        params.clerk_user_id,
        params.email,
        params.name,
        params.role,
        "active",
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
      .first<UserRow>();

    return result ? this.rowToUser(result) : null;
  }

  async findByClerkId(clerkUserId: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE clerk_user_id = ? AND deleted_at IS NULL`
      )
      .bind(clerkUserId)
      .first<UserRow>();

    return result ? this.rowToUser(result) : null;
  }

  async listByOrganization(
    organizationId: string,
    options: { cursor?: string; limit: number }
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { cursor, limit } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);

    let whereClause = "WHERE organization_id = ? AND deleted_at IS NULL";
    const params: unknown[] = [organizationId];

    if (cursor) {
      whereClause += " AND created_at > (SELECT created_at FROM users WHERE id = ?)";
      params.push(cursor);
    }

    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC LIMIT ?`;

    const dataResult = await this.db
      .prepare(dataQuery)
      .bind(...params, queryLimit)
      .all<UserRow>();

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = items.map((row) => this.rowToUser(row));

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async update(id: string, params: { name?: string; role?: string; status?: string }): Promise<void> {
    const setClauses: string[] = [];
    const bindParams: unknown[] = [];

    if (params.name !== undefined) {
      setClauses.push("name = ?");
      bindParams.push(params.name);
    }

    if (params.role !== undefined) {
      setClauses.push("role = ?");
      bindParams.push(params.role);
    }

    if (params.status !== undefined) {
      setClauses.push("status = ?");
      bindParams.push(params.status);
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

  private rowToUser(row: UserRow): Record<string, unknown> {
    return {
      id: row.id,
      organization_id: row.organization_id,
      clerk_user_id: row.clerk_user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    };
  }
}
