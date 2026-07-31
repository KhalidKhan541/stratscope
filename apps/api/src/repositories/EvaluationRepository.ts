/**
 * D1-backed implementation of the EvaluationRepository.
 *
 * Handles all persistence operations for Evaluation domain objects
 * using Cloudflare D1 with parameterized queries.
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { ExecutionId, EvaluationId, ProjectId, OrganizationId } from "@stratscope/core";
import type {
  Evaluation,
  EvaluationScore,
  EvaluationDimension,
} from "@stratscope/core/src/domain/evaluation/Evaluation";

/**
 * Pagination options for listing evaluations.
 */
export interface PaginationOptions {
  readonly cursor?: string;
  readonly limit: number;
  readonly direction?: "forward" | "backward";
}

/**
 * Paginated result set.
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
  readonly total_count: number;
}

/**
 * Raw D1 row shape for evaluations.
 */
interface EvaluationRow {
  readonly id: string;
  readonly execution_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly overall_score: number;
  readonly scores: string;
  readonly evaluation_model_version: string;
  readonly summary: string | null;
  readonly notes: string | null;
  readonly source: string;
  readonly created_at: string;
}

/**
 * Repository interface for evaluation persistence.
 */
export interface IEvaluationRepository {
  create(evaluation: Evaluation): Promise<void>;
  findById(id: string): Promise<Evaluation | null>;
  findByExecutionId(executionId: ExecutionId): Promise<Evaluation[]>;
  listByProject(projectId: ProjectId, options: PaginationOptions): Promise<PaginatedResult<Evaluation>>;
}

/**
 * D1 implementation of the evaluation repository.
 */
export class D1EvaluationRepository implements IEvaluationRepository {
  private readonly db: D1Database;
  private readonly tableName: string;
  private readonly executionsTable: string;

  constructor(
    db: D1Database,
    tableName: string = "evaluations",
    executionsTable: string = "executions"
  ) {
    this.db = db;
    this.tableName = tableName;
    this.executionsTable = executionsTable;
  }

  async create(evaluation: Evaluation): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          execution_id,
          organization_id,
          project_id,
          overall_score,
          scores,
          evaluation_model_version,
          summary,
          notes,
          source,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        evaluation.evaluation_id,
        evaluation.execution_id,
        evaluation.organization_id,
        evaluation.project_id,
        evaluation.overall_score,
        JSON.stringify(evaluation.scores),
        evaluation.evaluation_model_version,
        evaluation.summary ?? null,
        evaluation.notes ?? null,
        evaluation.source,
        evaluation.created_at
      )
      .run();
  }

  async findById(id: string): Promise<Evaluation | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<EvaluationRow>();

    return result ? this.rowToEvaluation(result) : null;
  }

  async findByExecutionId(executionId: ExecutionId): Promise<Evaluation[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE execution_id = ?
         ORDER BY created_at DESC`
      )
      .bind(executionId)
      .all<EvaluationRow>();

    return result.results.map((row) => this.rowToEvaluation(row));
  }

  async listByProject(
    projectId: ProjectId,
    options: PaginationOptions
  ): Promise<PaginatedResult<Evaluation>> {
    const { cursor, limit, direction = "forward" } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);
    const isForward = direction === "forward";

    let whereClause = `WHERE e.project_id = ?`;
    const params: unknown[] = [projectId];

    if (cursor) {
      if (isForward) {
        whereClause += " AND e.created_at > (SELECT created_at FROM evaluations WHERE id = ?)";
      } else {
        whereClause += " AND e.created_at < (SELECT created_at FROM evaluations WHERE id = ?)";
      }
      params.push(cursor);
    }

    const orderClause = isForward ? "ORDER BY e.created_at ASC" : "ORDER BY e.created_at DESC";
    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT e.* FROM ${this.tableName} e ${whereClause} ${orderClause} LIMIT ?`;
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} e ${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
      this.db.prepare(dataQuery).bind(...params, queryLimit).all<EvaluationRow>(),
      this.db.prepare(countQuery).bind(...params).first<{ readonly total: number }>(),
    ]);

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = isForward
      ? items.map((row) => this.rowToEvaluation(row))
      : items.map((row) => this.rowToEvaluation(row)).reverse();

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: countResult?.total ?? 0,
    };
  }

  private rowToEvaluation(row: EvaluationRow): Evaluation {
    let scores: EvaluationScore[] = [];
    try {
      scores = JSON.parse(row.scores) as EvaluationScore[];
    } catch {
      scores = [];
    }

    return {
      evaluation_id: row.id as EvaluationId,
      execution_id: row.execution_id as ExecutionId,
      organization_id: row.organization_id as OrganizationId,
      project_id: row.project_id as ProjectId,
      scores,
      overall_score: row.overall_score,
      created_at: row.created_at,
      evaluation_model_version: row.evaluation_model_version,
      summary: row.summary ?? undefined,
      notes: row.notes ?? undefined,
      source: row.source as "automated" | "human" | "hybrid",
    };
  }
}
