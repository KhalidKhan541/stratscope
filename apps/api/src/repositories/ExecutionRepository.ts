/**
 * D1-backed implementation of the ExecutionRepository.
 *
 * Handles all persistence operations for Execution domain objects
 * using Cloudflare D1 with parameterized queries.
 */

import type { D1Database } from "@cloudflare/workers-types";
import type {
  ExecutionId,
  OrganizationId,
  ProjectId,
} from "@stratscope/core";
import type { Execution } from "@stratscope/core/src/domain/execution/Execution";

/**
 * Query parameters for listing executions.
 */
export interface ListExecutionsQuery {
  readonly organization_id: OrganizationId;
  readonly project_id?: ProjectId;
  readonly status?: string;
  readonly agent_id?: string;
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
 * Time range for aggregate queries.
 */
export interface TimeRange {
  readonly start: string;
  readonly end: string;
}

/**
 * Execution statistics for a project.
 */
export interface ExecutionStats {
  readonly total_count: number;
  readonly completed_count: number;
  readonly failed_count: number;
  readonly average_latency_ms: number;
  readonly total_tokens: number;
  readonly total_cost: number;
}

/**
 * Raw D1 row shape for executions.
 */
interface ExecutionRow {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id: string | null;
  readonly status: string;
  readonly model: string;
  readonly provider: string;
  readonly trace_id: string;
  readonly parent_execution_id: string | null;
  readonly pipeline_version: string;
  readonly sdk_version: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly latency_ms: number | null;
  readonly queue_latency_ms: number | null;
  readonly processing_latency_ms: number | null;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
  readonly estimated_cost: number;
  readonly metadata: string;
  readonly error: string | null;
  readonly created_at: string;
}

/**
 * Repository interface for execution persistence.
 */
export interface IExecutionRepository {
  create(execution: Execution): Promise<void>;
  findById(id: ExecutionId, organizationId: OrganizationId): Promise<Execution | null>;
  findByIdempotent(id: ExecutionId): Promise<Execution | null>;
  list(query: ListExecutionsQuery): Promise<PaginatedResult<Execution>>;
  update(id: ExecutionId, update: Partial<Execution>): Promise<void>;
  countByOrganization(organizationId: OrganizationId): Promise<number>;
  countByProject(projectId: ProjectId): Promise<number>;
  getStatsByProject(projectId: ProjectId, timeRange: TimeRange): Promise<ExecutionStats>;
}

/**
 * D1 implementation of the execution repository.
 */
export class D1ExecutionRepository implements IExecutionRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "executions") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(execution: Execution): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          organization_id,
          project_id,
          agent_id,
          status,
          model,
          provider,
          trace_id,
          parent_execution_id,
          pipeline_version,
          sdk_version,
          started_at,
          completed_at,
          latency_ms,
          queue_latency_ms,
          processing_latency_ms,
          input_tokens,
          output_tokens,
          total_tokens,
          estimated_cost,
          metadata,
          error,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        execution.execution_id,
        execution.organization_id,
        execution.project_id,
        execution.agent_id,
        execution.status,
        execution.model,
        execution.provider,
        execution.trace_id,
        execution.parent_execution_id,
        execution.pipeline_version,
        execution.sdk_version,
        execution.started_at,
        execution.completed_at,
        execution.latency_ms,
        execution.queue_latency_ms,
        execution.processing_latency_ms,
        execution.input_tokens,
        execution.output_tokens,
        execution.total_tokens,
        execution.estimated_cost,
        JSON.stringify(execution.metadata),
        execution.error ? JSON.stringify(execution.error) : null,
        execution.created_at
      )
      .run();
  }

  async findById(id: ExecutionId, organizationId: OrganizationId): Promise<Execution | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE id = ? AND organization_id = ?`
      )
      .bind(id, organizationId)
      .first<ExecutionRow>();

    return result ? this.rowToExecution(result) : null;
  }

  async findByIdempotent(id: ExecutionId): Promise<Execution | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<ExecutionRow>();

    return result ? this.rowToExecution(result) : null;
  }

  async list(query: ListExecutionsQuery): Promise<PaginatedResult<Execution>> {
    const { organization_id, project_id, status, agent_id, cursor, limit, direction = "forward" } = query;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);
    const isForward = direction === "forward";

    let whereClause = "WHERE organization_id = ?";
    const params: unknown[] = [organization_id];

    if (project_id) {
      whereClause += " AND project_id = ?";
      params.push(project_id);
    }

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    if (agent_id) {
      whereClause += " AND agent_id = ?";
      params.push(agent_id);
    }

    if (cursor) {
      if (isForward) {
        whereClause += " AND created_at > (SELECT created_at FROM executions WHERE id = ?)";
      } else {
        whereClause += " AND created_at < (SELECT created_at FROM executions WHERE id = ?)";
      }
      params.push(cursor);
    }

    const orderClause = isForward ? "ORDER BY created_at ASC" : "ORDER BY created_at DESC";
    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT * FROM ${this.tableName} ${whereClause} ${orderClause} LIMIT ?`;
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
      this.db.prepare(dataQuery).bind(...params, queryLimit).all<ExecutionRow>(),
      this.db.prepare(countQuery).bind(...params).first<{ readonly total: number }>(),
    ]);

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = isForward
      ? items.map((row) => this.rowToExecution(row))
      : items.map((row) => this.rowToExecution(row)).reverse();

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

  async update(id: ExecutionId, update: Partial<Execution>): Promise<void> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const fieldMap: Record<string, string> = {
      status: "status",
      agent_id: "agent_id",
      started_at: "started_at",
      completed_at: "completed_at",
      latency_ms: "latency_ms",
      queue_latency_ms: "queue_latency_ms",
      processing_latency_ms: "processing_latency_ms",
      input_tokens: "input_tokens",
      output_tokens: "output_tokens",
      total_tokens: "total_tokens",
      estimated_cost: "estimated_cost",
      metadata: "metadata",
      error: "error",
    };

    for (const [key, value] of Object.entries(update)) {
      if (key === "execution_id" || key === "organization_id" || key === "created_at") {
        continue;
      }
      const column = fieldMap[key];
      if (column) {
        setClauses.push(`${column} = ?`);
        if (key === "metadata" || key === "error") {
          params.push(value !== null ? JSON.stringify(value) : null);
        } else {
          params.push(value);
        }
      }
    }

    if (setClauses.length === 0) {
      return;
    }

    params.push(id);

    await this.db
      .prepare(
        `UPDATE ${this.tableName}
         SET ${setClauses.join(", ")}
         WHERE id = ?`
      )
      .bind(...params)
      .run();
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ${this.tableName}
         WHERE organization_id = ?`
      )
      .bind(organizationId)
      .first<{ readonly total: number }>();

    return result?.total ?? 0;
  }

  async countByProject(projectId: ProjectId): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ${this.tableName}
         WHERE project_id = ?`
      )
      .bind(projectId)
      .first<{ readonly total: number }>();

    return result?.total ?? 0;
  }

  async getStatsByProject(projectId: ProjectId, timeRange: TimeRange): Promise<ExecutionStats> {
    const result = await this.db
      .prepare(
        `SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms ELSE 0 END) as average_latency_ms,
          SUM(COALESCE(total_tokens, 0)) as total_tokens,
          SUM(COALESCE(estimated_cost, 0)) as total_cost
         FROM ${this.tableName}
         WHERE project_id = ?
         AND created_at >= ?
         AND created_at <= ?`
      )
      .bind(projectId, timeRange.start, timeRange.end)
      .first<{
        readonly total_count: number;
        readonly completed_count: number;
        readonly failed_count: number;
        readonly average_latency_ms: number;
        readonly total_tokens: number;
        readonly total_cost: number;
      }>();

    return {
      total_count: result?.total_count ?? 0,
      completed_count: result?.completed_count ?? 0,
      failed_count: result?.failed_count ?? 0,
      average_latency_ms: result?.average_latency_ms ?? 0,
      total_tokens: result?.total_tokens ?? 0,
      total_cost: result?.total_cost ?? 0,
    };
  }

  private rowToExecution(row: ExecutionRow): Execution {
    return {
      execution_id: row.id as Execution["execution_id"],
      organization_id: row.organization_id as Execution["organization_id"],
      project_id: row.project_id as Execution["project_id"],
      agent_id: row.agent_id as Execution["agent_id"],
      status: row.status as Execution["status"],
      model: row.model,
      provider: row.provider,
      trace_id: row.trace_id,
      parent_execution_id: row.parent_execution_id as Execution["parent_execution_id"],
      pipeline_version: row.pipeline_version,
      sdk_version: row.sdk_version,
      started_at: row.started_at,
      completed_at: row.completed_at,
      latency_ms: row.latency_ms,
      queue_latency_ms: row.queue_latency_ms,
      processing_latency_ms: row.processing_latency_ms,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      total_tokens: row.total_tokens,
      estimated_cost: row.estimated_cost,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
      error: row.error ? (JSON.parse(row.error) as Record<string, unknown>) : null,
      created_at: row.created_at,
    };
  }
}
