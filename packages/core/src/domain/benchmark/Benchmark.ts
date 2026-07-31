/**
 * Benchmark — A standardized comparison of models, tools, or workflows
 * derived from execution intelligence data.
 */

import type { OrganizationId, ProjectId } from "../../shared/ids/Ids";

/** The type of benchmark being run. */
export type BenchmarkType =
  | "model_comparison"
  | "tool_comparison"
  | "latency_comparison"
  | "cost_comparison"
  | "success_rate"
  | "hallucination_rate"
  | "agent_comparison"
  | "execution_quality";

/** The lifecycle status of a benchmark. */
export type BenchmarkStatus = "draft" | "running" | "completed" | "failed";

/** A single metric measured within a benchmark entry. */
export interface BenchmarkMetric {
  /** Name of the metric (e.g. "latency_p95"). */
  readonly name: string;
  /** Numeric value of the metric. */
  readonly value: number;
  /** Unit of measurement (e.g. "ms", "usd", "count"). */
  readonly unit: string;
  /** Number of samples used to compute this metric. */
  readonly sample_size: number;
}

/** An entry (candidate) within a benchmark comparison. */
export interface BenchmarkEntry {
  /** Name of the entry (e.g. model name or tool identifier). */
  readonly name: string;
  /** Measured metrics for this entry. */
  readonly metrics: readonly BenchmarkMetric[];
  /** Arbitrary metadata for this entry. */
  readonly metadata: Record<string, unknown>;
}

/** A benchmark comparing multiple candidates against execution data. */
export interface Benchmark {
  /** Unique identifier for this benchmark. */
  readonly id: string;
  /** Organization this benchmark belongs to. */
  readonly organization_id: OrganizationId;
  /** Project this benchmark belongs to. */
  readonly project_id: ProjectId;
  /** Human-readable name. */
  readonly name: string;
  /** Detailed description of the benchmark. */
  readonly description: string;
  /** The type of comparison being performed. */
  readonly benchmark_type: BenchmarkType;
  /** Current lifecycle status. */
  readonly status: BenchmarkStatus;
  /** The entries being compared. */
  readonly entries: readonly BenchmarkEntry[];
  /** ID of the dataset used for this benchmark, if any. */
  readonly dataset_id: string | null;
  /** Configuration parameters for the benchmark run. */
  readonly config: Record<string, unknown>;
  /** Aggregated results, null if not yet completed. */
  readonly results: Record<string, unknown> | null;
  /** ISO-8601 timestamp when execution started, null if not started. */
  readonly started_at: string | null;
  /** ISO-8601 timestamp when execution completed, null if not completed. */
  readonly completed_at: string | null;
  /** ISO-8601 timestamp when this benchmark was created. */
  readonly created_at: string;
  /** ISO-8601 timestamp when this benchmark was last updated. */
  readonly updated_at: string;
}

/** Creates a new Benchmark record. */
export function createBenchmark(params: {
  readonly organization_id: OrganizationId;
  readonly project_id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly benchmark_type: BenchmarkType;
  readonly dataset_id?: string | null;
  readonly config?: Record<string, unknown>;
}): Benchmark {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organization_id: params.organization_id,
    project_id: params.project_id,
    name: params.name,
    description: params.description,
    benchmark_type: params.benchmark_type,
    status: "draft",
    entries: [],
    dataset_id: params.dataset_id ?? null,
    config: params.config ?? {},
    results: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
}
