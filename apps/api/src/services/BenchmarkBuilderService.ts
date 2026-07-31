import type { OrganizationId, ProjectId } from "@stratscope/core";
import type {
  Benchmark,
  BenchmarkType,
  BenchmarkEntry,
  BenchmarkMetric,
} from "@stratscope/core";

/**
 * Contract for the benchmark builder service.
 */
interface IBenchmarkBuilderService {
  /**
   * Create a new benchmark definition.
   *
   * @param params - Benchmark configuration.
   * @returns The newly created benchmark in draft status.
   */
  createBenchmark(params: {
    /** The owning organization. */
    readonly organization_id: OrganizationId;
    /** The target project. */
    readonly project_id: ProjectId;
    /** Human-readable benchmark name. */
    readonly name: string;
    /** Description of the benchmark's purpose. */
    readonly description: string;
    /** The type of benchmark to run. */
    readonly benchmark_type: BenchmarkType;
    /** Optional dataset ID to use for the benchmark. */
    readonly dataset_id?: string;
  }): Promise<Benchmark>;

  /**
   * Execute a benchmark and compute aggregate metrics.
   *
   * @param id - The benchmark ID to run.
   * @returns The benchmark with computed results.
   */
  runBenchmark(id: string): Promise<Benchmark>;

  /**
   * Retrieve a benchmark by ID within an organization.
   *
   * @param id - The benchmark ID.
   * @param organizationId - The organization scope.
   * @returns The benchmark, or null if not found.
   */
  getBenchmark(
    id: string,
    organizationId: OrganizationId
  ): Promise<Benchmark | null>;

  /**
   * List benchmarks for an organization with cursor pagination.
   *
   * @param organizationId - The organization scope.
   * @param options - Pagination options.
   * @returns Paginated list of benchmarks.
   */
  listBenchmarks(
    organizationId: OrganizationId,
    options: { readonly cursor?: string; readonly limit: number }
  ): Promise<{
    readonly items: readonly Benchmark[];
    readonly next_cursor: string | null;
    readonly has_more: boolean;
  }>;
}

/**
 * Service that creates and runs benchmarks against execution data.
 *
 * Aggregates execution metrics by model to produce comparative benchmark results.
 */
export class BenchmarkBuilderService implements IBenchmarkBuilderService {
  /**
   * Create a new BenchmarkBuilderService.
   *
   * @param db - Cloudflare D1 database binding.
   */
  constructor(private readonly db: D1Database) {}

  /** {@inheritDoc IBenchmarkBuilderService.createBenchmark} */
  async createBenchmark(params: {
    /** The owning organization. */
    readonly organization_id: OrganizationId;
    /** The target project. */
    readonly project_id: ProjectId;
    /** Human-readable benchmark name. */
    readonly name: string;
    /** Description of the benchmark's purpose. */
    readonly description: string;
    /** The type of benchmark to run. */
    readonly benchmark_type: BenchmarkType;
    /** Optional dataset ID to use. */
    readonly dataset_id?: string;
  }): Promise<Benchmark> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const benchmark: Benchmark = {
      id,
      organization_id: params.organization_id,
      project_id: params.project_id,
      name: params.name,
      description: params.description,
      benchmark_type: params.benchmark_type,
      status: "draft",
      entries: [],
      dataset_id: params.dataset_id ?? null,
      config: {},
      results: null,
      started_at: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };

    await this.db
      .prepare(
        `INSERT INTO benchmarks (id, organization_id, project_id, name, description, benchmark_type, status, entries, dataset_id, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        benchmark.id,
        benchmark.organization_id,
        benchmark.project_id,
        benchmark.name,
        benchmark.description,
        benchmark.benchmark_type,
        benchmark.status,
        JSON.stringify(benchmark.entries),
        benchmark.dataset_id,
        JSON.stringify(benchmark.config),
        benchmark.created_at,
        benchmark.updated_at
      )
      .run();

    return benchmark;
  }

  /** {@inheritDoc IBenchmarkBuilderService.runBenchmark} */
  async runBenchmark(id: string): Promise<Benchmark> {
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE benchmarks SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(now, now, id)
      .run();

    // Aggregate metrics from executions
    const executions = await this.db
      .prepare(
        `SELECT model, provider, latency_ms, total_tokens, estimated_cost, status
         FROM executions WHERE project_id = (SELECT project_id FROM benchmarks WHERE id = ?)
         AND status = 'completed'`
      )
      .bind(id)
      .all();

    const entries: BenchmarkEntry[] = [];
    const byModel = new Map<
      string,
      { latencies: number[]; costs: number[]; tokens: number[] }
    >();

    for (const exec of executions.results ?? []) {
      const model = exec.model as string;
      if (!byModel.has(model))
        byModel.set(model, { latencies: [], costs: [], tokens: [] });
      const agg = byModel.get(model)!;
      agg.latencies.push(exec.latency_ms as number);
      agg.costs.push(exec.estimated_cost as number);
      agg.tokens.push(exec.total_tokens as number);
    }

    for (const [model, agg] of byModel) {
      entries.push({
        name: model,
        metrics: [
          {
            name: "avg_latency_ms",
            value:
              agg.latencies.reduce((a, b) => a + b, 0) / agg.latencies.length,
            unit: "ms",
            sample_size: agg.latencies.length,
          },
          {
            name: "avg_cost",
            value:
              agg.costs.reduce((a, b) => a + b, 0) / agg.costs.length,
            unit: "usd",
            sample_size: agg.costs.length,
          },
          {
            name: "avg_tokens",
            value:
              agg.tokens.reduce((a, b) => a + b, 0) / agg.tokens.length,
            unit: "tokens",
            sample_size: agg.tokens.length,
          },
          {
            name: "total_executions",
            value: agg.latencies.length,
            unit: "count",
            sample_size: agg.latencies.length,
          },
        ],
        metadata: {},
      });
    }

    const completedAt = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE benchmarks SET status = 'completed', entries = ?, completed_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(JSON.stringify(entries), completedAt, completedAt, id)
      .run();

    const row = await this.db
      .prepare(`SELECT * FROM benchmarks WHERE id = ?`)
      .bind(id)
      .first();
    return this.mapRowToBenchmark(row!);
  }

  /** {@inheritDoc IBenchmarkBuilderService.getBenchmark} */
  async getBenchmark(
    id: string,
    organizationId: OrganizationId
  ): Promise<Benchmark | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM benchmarks WHERE id = ? AND organization_id = ?`
      )
      .bind(id, organizationId)
      .first();
    return row ? this.mapRowToBenchmark(row) : null;
  }

  /** {@inheritDoc IBenchmarkBuilderService.listBenchmarks} */
  async listBenchmarks(
    organizationId: OrganizationId,
    options: { readonly cursor?: string; readonly limit: number }
  ): Promise<{
    readonly items: readonly Benchmark[];
    readonly next_cursor: string | null;
    readonly has_more: boolean;
  }> {
    const limit = Math.min(Math.max(options.limit, 1), 100);
    const query = options.cursor
      ? `SELECT * FROM benchmarks WHERE organization_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM benchmarks WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`;
    const params = options.cursor
      ? [organizationId, options.cursor, limit + 1]
      : [organizationId, limit + 1];
    const rows = await this.db.prepare(query).bind(...params).all();
    const items = (rows.results ?? []).map(this.mapRowToBenchmark);
    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    return {
      items: sliced,
      next_cursor: hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.created_at : null,
      has_more: hasMore,
    };
  }

  /**
   * Map a raw database row to a typed Benchmark object.
   *
   * @param row - The raw D1 row.
   * @returns A fully typed Benchmark.
   */
  private mapRowToBenchmark(row: Record<string, unknown>): Benchmark {
    return {
      id: row.id as string,
      organization_id: row.organization_id as OrganizationId,
      project_id: row.project_id as ProjectId,
      name: row.name as string,
      description: row.description as string,
      benchmark_type: row.benchmark_type as Benchmark["benchmark_type"],
      status: row.status as Benchmark["status"],
      entries: JSON.parse((row.entries as string) ?? "[]"),
      dataset_id: row.dataset_id as string | null,
      config: JSON.parse((row.config as string) ?? "{}"),
      results: row.results ? JSON.parse(row.results as string) : null,
      started_at: row.started_at as string | null,
      completed_at: row.completed_at as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}
