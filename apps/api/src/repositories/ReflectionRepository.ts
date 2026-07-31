/**
 * D1-backed implementation of the ReflectionRepository.
 *
 * Handles all persistence operations for Reflection domain objects
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
 * Raw D1 row shape for reflections.
 */
interface ReflectionRow {
  readonly id: string;
  readonly execution_id: string;
  readonly summary: string;
  readonly strengths: string;
  readonly weaknesses: string;
  readonly recommendations: string;
  readonly confidence: number;
  readonly reflection_model: string;
  readonly reasoning: string;
  readonly created_at: string;
}

/**
 * Repository interface for reflection persistence.
 */
export interface ReflectionRepository {
  create(params: {
    readonly id: string;
    readonly execution_id: string;
    readonly summary: string;
    readonly strengths: readonly string[];
    readonly weaknesses: readonly string[];
    readonly recommendations: readonly string[];
    readonly confidence: number;
    readonly reflection_model: string;
    readonly reasoning: string;
  }): Promise<void>;
  findById(id: string): Promise<Record<string, unknown> | null>;
  listByExecution(executionId: string): Promise<readonly Record<string, unknown>[]>;
  listByProject(
    projectId: string,
    options: { cursor?: string; limit: number }
  ): Promise<PaginatedResult<Record<string, unknown>>>;
  countByProject(projectId: string): Promise<number>;
}

/**
 * D1 implementation of the reflection repository.
 */
export class D1ReflectionRepository implements ReflectionRepository {
  private readonly db: D1Database;
  private readonly tableName: string;
  private readonly executionsTable: string;

  constructor(
    db: D1Database,
    tableName: string = "reflections",
    executionsTable: string = "executions"
  ) {
    this.db = db;
    this.tableName = tableName;
    this.executionsTable = executionsTable;
  }

  async create(params: {
    readonly id: string;
    readonly execution_id: string;
    readonly summary: string;
    readonly strengths: readonly string[];
    readonly weaknesses: readonly string[];
    readonly recommendations: readonly string[];
    readonly confidence: number;
    readonly reflection_model: string;
    readonly reasoning: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          execution_id,
          summary,
          strengths,
          weaknesses,
          recommendations,
          confidence,
          reflection_model,
          reasoning,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.execution_id,
        params.summary,
        JSON.stringify(params.strengths),
        JSON.stringify(params.weaknesses),
        JSON.stringify(params.recommendations),
        params.confidence,
        params.reflection_model,
        params.reasoning,
        new Date().toISOString()
      )
      .run();
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<ReflectionRow>();

    return result ? this.rowToReflection(result) : null;
  }

  async listByExecution(executionId: string): Promise<readonly Record<string, unknown>[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE execution_id = ?
         ORDER BY created_at DESC`
      )
      .bind(executionId)
      .all<ReflectionRow>();

    return Object.freeze(
      result.results.map((row) => this.rowToReflection(row))
    );
  }

  async listByProject(
    projectId: string,
    options: { cursor?: string; limit: number }
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { cursor, limit } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);

    let whereClause = `WHERE r.execution_id IN (
      SELECT id FROM ${this.executionsTable} WHERE project_id = ?
    )`;
    const params: unknown[] = [projectId];

    if (cursor) {
      whereClause += " AND r.created_at > (SELECT created_at FROM reflections WHERE id = ?)";
      params.push(cursor);
    }

    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT r.* FROM ${this.tableName} r ${whereClause} ORDER BY r.created_at DESC LIMIT ?`;

    const dataResult = await this.db
      .prepare(dataQuery)
      .bind(...params, queryLimit)
      .all<ReflectionRow>();

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = items.map((row) => this.rowToReflection(row));

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async countByProject(projectId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ${this.tableName} r
         WHERE r.execution_id IN (
           SELECT id FROM ${this.executionsTable} WHERE project_id = ?
         )`
      )
      .bind(projectId)
      .first<{ readonly total: number }>();

    return result?.total ?? 0;
  }

  private rowToReflection(row: ReflectionRow): Record<string, unknown> {
    return {
      id: row.id,
      execution_id: row.execution_id,
      summary: row.summary,
      strengths: JSON.parse(row.strengths) as readonly string[],
      weaknesses: JSON.parse(row.weaknesses) as readonly string[],
      recommendations: JSON.parse(row.recommendations) as readonly string[],
      confidence: row.confidence,
      reflection_model: row.reflection_model,
      reasoning: row.reasoning,
      created_at: row.created_at,
    };
  }
}
