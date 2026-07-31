/**
 * D1-backed implementation of the LearningRepository.
 *
 * Handles all persistence operations for Learning records
 * using Cloudflare D1 with parameterized queries.
 */

import type { D1Database } from "@cloudflare/workers-types";

/**
 * Query parameters for listing learning records.
 */
export interface ListLearningOptions {
  readonly project_id: string;
  readonly cursor?: string;
  readonly limit: number;
  readonly pattern_type?: string;
  readonly severity?: string;
}

/**
 * Paginated result set.
 */
export interface LearningPaginatedResult {
  readonly items: readonly Record<string, unknown>[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
}

/**
 * Raw D1 row shape for learning records.
 */
interface LearningRow {
  readonly id: string;
  readonly execution_id: string;
  readonly project_id: string;
  readonly pattern_type: string;
  readonly pattern: string;
  readonly frequency: number;
  readonly severity: string;
  readonly suggestion: string;
  readonly evidence: string;
  readonly created_at: string;
}

/**
 * Repository interface for learning persistence.
 */
export interface LearningRepository {
  create(params: {
    readonly id: string;
    readonly execution_id: string;
    readonly project_id: string;
    readonly pattern_type: string;
    readonly pattern: string;
    readonly frequency: number;
    readonly severity: string;
    readonly suggestion: string;
    readonly evidence: Record<string, unknown>;
  }): Promise<void>;
  findById(id: string): Promise<Record<string, unknown> | null>;
  listByProject(options: ListLearningOptions): Promise<LearningPaginatedResult>;
  listByType(projectId: string, patternType: string): Promise<readonly Record<string, unknown>[]>;
  countByProject(projectId: string): Promise<number>;
}

/**
 * D1 implementation of the learning repository.
 */
export class D1LearningRepository implements LearningRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "learning_records") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(params: {
    readonly id: string;
    readonly execution_id: string;
    readonly project_id: string;
    readonly pattern_type: string;
    readonly pattern: string;
    readonly frequency: number;
    readonly severity: string;
    readonly suggestion: string;
    readonly evidence: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          execution_id,
          project_id,
          pattern_type,
          pattern,
          frequency,
          severity,
          suggestion,
          evidence,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.execution_id,
        params.project_id,
        params.pattern_type,
        params.pattern,
        params.frequency,
        params.severity,
        params.suggestion,
        JSON.stringify(params.evidence),
        new Date().toISOString()
      )
      .run();
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<LearningRow>();

    return result ? this.rowToRecord(result) : null;
  }

  async listByProject(options: ListLearningOptions): Promise<LearningPaginatedResult> {
    const { project_id, cursor, limit, pattern_type, severity } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);

    let whereClause = "WHERE project_id = ?";
    const params: unknown[] = [project_id];

    if (pattern_type) {
      whereClause += " AND pattern_type = ?";
      params.push(pattern_type);
    }

    if (severity) {
      whereClause += " AND severity = ?";
      params.push(severity);
    }

    if (cursor) {
      whereClause += " AND created_at > (SELECT created_at FROM learning_records WHERE id = ?)";
      params.push(cursor);
    }

    const orderClause = "ORDER BY created_at ASC";
    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT * FROM ${this.tableName} ${whereClause} ${orderClause} LIMIT ?`;

    const dataResult = await this.db
      .prepare(dataQuery)
      .bind(...params, queryLimit)
      .all<LearningRow>();

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = items.map((row) => this.rowToRecord(row));

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async listByType(projectId: string, patternType: string): Promise<readonly Record<string, unknown>[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE project_id = ? AND pattern_type = ?
         ORDER BY created_at DESC`
      )
      .bind(projectId, patternType)
      .all<LearningRow>();

    return Object.freeze(result.results.map((row) => this.rowToRecord(row)));
  }

  async countByProject(projectId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ${this.tableName}
         WHERE project_id = ?`
      )
      .bind(projectId)
      .first<{ readonly total: number }>();

    return result?.total ?? 0;
  }

  private rowToRecord(row: LearningRow): Record<string, unknown> {
    return {
      id: row.id,
      execution_id: row.execution_id,
      project_id: row.project_id,
      pattern_type: row.pattern_type,
      pattern: row.pattern,
      frequency: row.frequency,
      severity: row.severity,
      suggestion: row.suggestion,
      evidence: JSON.parse(row.evidence) as Record<string, unknown>,
      created_at: row.created_at,
    };
  }
}
