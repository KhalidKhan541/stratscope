/**
 * D1-backed implementation of the OrganizationRepository.
 *
 * Handles all persistence operations for Organization domain objects
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
 * Raw D1 row shape for organizations.
 */
interface OrganizationRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly plan: string;
  readonly settings: string;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

/**
 * Repository interface for organization persistence.
 */
export interface OrganizationRepository {
  create(params: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly plan: string;
    readonly settings: Record<string, unknown>;
  }): Promise<void>;
  findById(id: string): Promise<Record<string, unknown> | null>;
  findBySlug(slug: string): Promise<Record<string, unknown> | null>;
  list(options: { cursor?: string; limit: number }): Promise<PaginatedResult<Record<string, unknown>>>;
  update(id: string, params: { name?: string; plan?: string; settings?: Record<string, unknown> }): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * D1 implementation of the organization repository.
 */
export class D1OrganizationRepository implements OrganizationRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "organizations") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(params: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly plan: string;
    readonly settings: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          name,
          slug,
          plan,
          settings,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.name,
        params.slug,
        params.plan,
        JSON.stringify(params.settings),
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
      .first<OrganizationRow>();

    return result ? this.rowToOrganization(result) : null;
  }

  async findBySlug(slug: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE slug = ? AND deleted_at IS NULL`
      )
      .bind(slug)
      .first<OrganizationRow>();

    return result ? this.rowToOrganization(result) : null;
  }

  async list(options: { cursor?: string; limit: number }): Promise<PaginatedResult<Record<string, unknown>>> {
    const { cursor, limit } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);

    let whereClause = "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (cursor) {
      whereClause += " AND created_at > (SELECT created_at FROM organizations WHERE id = ?)";
      params.push(cursor);
    }

    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC LIMIT ?`;

    const dataResult = await this.db
      .prepare(dataQuery)
      .bind(...params, queryLimit)
      .all<OrganizationRow>();

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = items.map((row) => this.rowToOrganization(row));

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async update(id: string, params: { name?: string; plan?: string; settings?: Record<string, unknown> }): Promise<void> {
    const setClauses: string[] = [];
    const bindParams: unknown[] = [];

    if (params.name !== undefined) {
      setClauses.push("name = ?");
      bindParams.push(params.name);
    }

    if (params.plan !== undefined) {
      setClauses.push("plan = ?");
      bindParams.push(params.plan);
    }

    if (params.settings !== undefined) {
      setClauses.push("settings = ?");
      bindParams.push(JSON.stringify(params.settings));
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

  private rowToOrganization(row: OrganizationRow): Record<string, unknown> {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      settings: JSON.parse(row.settings) as Record<string, unknown>,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    };
  }
}
